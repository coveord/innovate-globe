import { FunctionComponent, useEffect, useRef, useState } from "react";
import ReactGlobeGl, { GlobeMethods } from "react-globe.gl";
import globeData from "./data/admin-data.json";
import {
  AWSRegionGeo,
  ValidRegions,
  envRegionMapping,
  LiveEvent,
  CoveoEnvironment,
  RealTimeMetricsResponse,
} from "./Events";
import { uniqBy } from "lodash";
import * as THREE from "three";

interface ArcData {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  timestamp: number;
}

interface LabelData {
  lat: number;
  lng: number;
  text: string;
  timestamp: number;
}

interface PendingEvent {
  arc: Omit<ArcData, "timestamp">;
  label?: {
    lat: number;
    lng: number;
    text: string | null;
  };
}

interface AnimatedGlobeProps {
  renderArcs: boolean;
  renderLabels: boolean;
  anim: boolean;
  autoRotate: boolean;
  debug: boolean;
  tickSpeed: number;
  flightTime: number;
  arcRelativeLength: number;
  arcDashGap: number;
  atmosphereAltitude: number;
  arcAltitudeAutoScale: number;
  env: CoveoEnvironment;
}

// Normalize the response until the lambda is updated everywhere.
const normalizeResponse = (response: RealTimeMetricsResponse | LiveEvent[] | {message: string}): LiveEvent[] => {
    if (Array.isArray(response)) {
      return response;
    }
    if ("message" in response) {
      throw new Error(response.message);
    }
    return response.items;
};

export const AnimatedGlobe: FunctionComponent<AnimatedGlobeProps> = ({
  renderArcs,
  renderLabels,
  anim,
  autoRotate,
  debug,
  tickSpeed,
  flightTime,
  arcRelativeLength,
  arcDashGap,
  arcAltitudeAutoScale,
  env,
}) => {
  const [arcsData, setArcsData] = useState<ArcData[]>([]);
  const [labelsData, setLabelsData] = useState<LabelData[]>([]);
  const [animationTick, setAnimationTick] = useState(0);
  const [geometryCount, setGeometryCount] = useState(0);

  const globeRef = useRef<GlobeMethods>();
  const scheduledArcTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearScheduledArcTimeouts = () => {
    scheduledArcTimeoutsRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    scheduledArcTimeoutsRef.current = [];
  };

  const sanitizeLabelText = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const addPendingEventToState = ({ arc, label }: PendingEvent) => {
    const timestamp = Date.now();
    const evictionTimeForArcs = flightTime + tickSpeed;
    const evictionTimeForLabels = flightTime + tickSpeed;

    setArcsData((currentArcs: ArcData[]) => {
      const now = Date.now();
      const filteredArcs = currentArcs.filter((entry) => now - entry.timestamp <= evictionTimeForArcs);
      return [...filteredArcs, { ...arc, timestamp }];
    });

    setLabelsData((currentLabels: LabelData[]) => {
      const now = Date.now();
      const filteredLabels = currentLabels.filter((entry) =>
        now - entry.timestamp <= evictionTimeForLabels && entry.text !== "null" && entry.text !== null
      );

      if (!renderLabels || !label || !label.text || label.text === "null") {
        return filteredLabels;
      }

      const sanitizedText = sanitizeLabelText(label.text);
      const updatedLabels: LabelData[] = [
        ...filteredLabels,
        {
          lat: label.lat,
          lng: label.lng,
          text: sanitizedText,
          timestamp,
        },
      ];

      return uniqBy(updatedLabels, (entry) => entry.text);
    });
  };

  const scheduleEventsForTick = (events: PendingEvent[]) => {
    if (events.length === 0) {
      return;
    }

    // Keep events flowing steadily across the tick window to avoid bursty updates.
    const interval = events.length > 0 ? tickSpeed / events.length : tickSpeed;

    events.forEach((event, index) => {
      const timeoutId = setTimeout(() => {
        addPendingEventToState(event);
        scheduledArcTimeoutsRef.current = scheduledArcTimeoutsRef.current.filter((id) => id !== timeoutId);
      }, Math.max(interval * index, 0));

      scheduledArcTimeoutsRef.current.push(timeoutId);
    });
  };

  const emitArc = async () => {
    const resTotal = new Map<ValidRegions, LiveEvent[]>();
    for (const regionConfig of envRegionMapping[env]) {
      const liveEventFetcher: LiveEvent[] = normalizeResponse(await (
        await fetch(`${regionConfig.lambdaEndpoint}&last=${tickSpeed}`)
      ).json());
      resTotal.set(regionConfig.region, liveEventFetcher);
    }

    const pendingEvents: PendingEvent[] = [];

    resTotal.forEach((liveEvents, region) => {
      liveEvents.forEach((liveEvent: LiveEvent) => {
        const latitude = Number(liveEvent.lat);
        const longitude = Number(liveEvent.lng);

        pendingEvents.push({
          arc: {
            startLat: latitude,
            endLat: AWSRegionGeo[region].lat,
            startLng: longitude,
            endLng: AWSRegionGeo[region].lng,
            color: "#8f7000",
          },
          label: renderLabels
            ? {
                lat: latitude,
                lng: longitude,
                text: liveEvent.city,
              }
            : undefined,
        });
      });
    });

    scheduleEventsForTick(pendingEvents);

    const nextTick = animationTick + 1;
    setAnimationTick(nextTick);
    if (debug && nextTick % 10 === 0 && nextTick !== 0) {
      const sceneJSON = globeRef.current?.scene().toJSON();
      setGeometryCount(sceneJSON.geometries.length);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(async () => {
      emitArc();
    }, tickSpeed);
    return () => {
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationTick]);

  useEffect(() => {
    return () => {
      clearScheduledArcTimeouts();
    };
  }, []);

  if (globeRef.current) {
    globeRef.current.controls().autoRotate = autoRotate;
    globeRef.current.controls().autoRotateSpeed = 0.6;
  }

  if (!anim) {
    globeRef.current?.pauseAnimation();
  } else {
    globeRef.current?.resumeAnimation();
  }

  const material = new THREE.MeshPhongMaterial({
    color: "#9dabf2",
    emissive: "#062d70",
  });

  const htmlElementsData = envRegionMapping[env].map(({region}) => {
    return {
      ...AWSRegionGeo[region],
      size: 1,
    };
  });

  return (
    <ReactGlobeGl
      labelsData={
        debug
          ? [
              { lat: 0, lng: 0, text: `Tick: ${animationTick.toString()}` },
              {
                lat: 2,
                lng: 0,
                text: `Arcs: ${arcsData.length}`,
              },
              {
                lat: 6,
                lng: 0,
                text: `Memory: ${Math.round(
                  (window.performance as any).memory.usedJSHeapSize / 1048576
                )} MB / ${Math.round(
                  (window.performance as any).memory.jsHeapSizeLimit / 1048576
                )} MB`,
              },
              {
                lat: 8,
                lng: 0,
                text: `ThreeJS Geometry count: ${
                  geometryCount === 0 ? "..." : geometryCount
                }`,
              },
              {
                lat: 10,
                lng: 0,
                text: `Labels: ${labelsData.length}`,
              },
            ].concat(labelsData)
          : labelsData
      }
      labelSize={() => 1}
      labelAltitude={0}
      labelResolution={2}
      labelIncludeDot={false}
      labelsTransitionDuration={0}
      ref={globeRef}
      arcsData={renderArcs ? arcsData : []}
      arcColor={"color"}
      arcDashLength={arcRelativeLength}
      arcDashGap={arcDashGap}
      arcDashInitialGap={1}
      arcDashAnimateTime={flightTime}
      arcsTransitionDuration={0}
      arcAltitudeAutoScale={arcAltitudeAutoScale}
      arcStroke={0.25}

      globeMaterial={material}
      backgroundColor={"#181d3a"}
      hexPolygonsData={[...globeData.features]}
      hexPolygonColor={() => "#34ad95"}
      hexPolygonMargin={0.3}
      showGlobe={true}
      htmlElementsData={htmlElementsData.concat([])}
      htmlElement={() => {
        const el = document.createElement("img");
        el.setAttribute("src", "/favicon.png");
        return el;
      }}
    />
  );
};
