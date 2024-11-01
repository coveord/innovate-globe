import React, { FunctionComponent, useEffect } from "react";
import { useState } from "react";
import { AnimatedGlobe } from "./AnimatedGlobe";

import {
  ActionIcon,
  Checkbox,
  Drawer,
  Grid,
  Group,
  Image,
  NumberInput,
  PasswordInput,
  ScrollArea,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import {
  useQueryParams,
  BooleanParam,
  NumberParam,
  StringParam,
} from "use-query-params";
import { IconAdjustments } from "@tabler/icons-react";
import {
  CoveoEnvironment,
  isCoveoEnvironment,
  normalizeCoveoEnvironment,
} from "./Events";

const ENVIRONMENTS = Object.freeze<
  Array<{ value: CoveoEnvironment; label: string }>
>([
  { value: "dev", label: "Development" },
  { value: "stg", label: "Staging" },
  { value: "prd", label: "Production" },
]);

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(value);

export const GlobeAndPanel: FunctionComponent = () => {
  const [query, setQuery] = useQueryParams({
    renderRings: BooleanParam,
    renderArcs: BooleanParam,
    renderLabels: BooleanParam,
    animate: BooleanParam,
    rotate: BooleanParam,
    debug: BooleanParam,
    tickSpeed: NumberParam,
    numRings: NumberParam,
    flightTime: NumberParam,
    arcRelLength: NumberParam,
    ringRadius: NumberParam,
    ringSpeed: NumberParam,
    numAnimation: NumberParam,
    arcDashGap: NumberParam,
    arcAltitude: NumberParam,
    atmosphereAltitude: NumberParam,
    eartImg: StringParam,
    env: StringParam,
  });

  const [pw, setPw] = useState("");

  const [renderRings, setRenderRings] = useState(
    query.renderRings ?? false
  );
  const [renderArcs, setRenderArcs] = useState(query.renderArcs ?? true);
  const [renderLabels, setRenderLabels] = useState(
    query.renderLabels ?? false
  );

  const [animate, setAnimate] = useState(query.animate ?? true);
  const [rotate, setRotate] = useState(query.rotate ?? true);
  const [debug, setDebug] = useState(query.debug ?? false);
  const [tickSpeed, setTickSpeed] = useState(query.tickSpeed ?? 1000);
  const [numRings, setNumRings] = useState(query.numRings ?? 1);
  const [flightTime, setFlightTime] = useState(query.flightTime ?? 2000);
  const [arcRelativeLength, setArcRelativeLength] = useState(
    query.arcRelLength ?? 0.5
  );
  const [ringRadius, setRingRadius] = useState(query.ringRadius ?? 3);
  const [ringSpeed, setRingSpeed] = useState(query.ringSpeed ?? 5);
  const [numberOfAnimation, setNumberOfAnimation] = useState(
    query.numAnimation ?? 50
  );
  const [arcDashGap, setArcDashGap] = useState(query.arcDashGap ?? 2);
  const [env, setEnv] = useState(normalizeCoveoEnvironment(query.env));
  const [arcAltitudeAutoScale, setArcAltitudeAutoScale] = useState(
    query.arcAltitude ?? 0.5
  );
  const [atmosphereAltitude, setAtmosphereAltitude] = useState(
    query.atmosphereAltitude ?? 0.2
  );
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!query.env) {
      setQuery({ env: "prd" });
    }
  }, [query.env, setQuery]);

  return (
    <div className="App">
      <Grid
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
          padding: "20px",
          color: "white",
          fontSize: "29px",
        }}
      >
        <Grid.Col span={6}>
          <Image src={"coveo.png"} style={{ width: "50px" }} />
        </Grid.Col>
        <Grid.Col span={6} style={{ borderLeft: "2px solid white" }}>
          <Text>bfcm'24</Text>
        </Grid.Col>
      </Grid>

      <Group
        position="center"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          zIndex: 1,
          padding: "20px",
        }}
      >
        <ActionIcon
          onClick={() => setOpened(true)}
          variant="transparent"
          color="rgba(255, 255, 255, 1)"
          size="xl"
          aria-label="Settings"
        >
          <IconAdjustments color={"white"} />
        </ActionIcon>
      </Group>
      <Drawer
        overlayProps={{ opacity: 0 }}
        opened={opened}
        onClose={() => setOpened(false)}
        title="Debug menu"
        padding="xl"
        size="xl"
        position={"right"}
        style={{ zIndex: 3 }}
      >
        <Stack>
          <ScrollArea style={{ height: "90vh" }} offsetScrollbars>
            <PasswordInput
              placeholder="Password"
              label="Password"
              value={pw}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  localStorage.setItem("pw", pw);
                  window.location.reload();
                }
              }}
              onChange={(event) => setPw(event.currentTarget.value)}
            />
            <Checkbox
              label="Render rings"
              checked={renderRings}
              onChange={() => {
                setRenderRings(!renderRings);
                setQuery({ renderRings: !renderRings });
              }}
            />
            <Checkbox
              label="Render Labels"
              checked={renderLabels}
              onChange={() => {
                setRenderLabels(!renderLabels);
                setQuery({ renderLabels: !renderLabels });
              }}
            />
            <Checkbox
              label="Render arcs"
              checked={renderArcs}
              onChange={() => {
                setRenderArcs(!renderArcs);
                setQuery({ renderArcs: !renderArcs });
              }}
            />
            <Checkbox
              label="Play animation"
              checked={animate}
              onChange={() => {
                setAnimate(!animate);
                setQuery({ animate: !animate });
              }}
            />
            <Checkbox
              label="Auto rotate"
              checked={rotate}
              onChange={() => {
                setRotate(!rotate);
                setQuery({ rotate: !rotate });
              }}
            />
            <Checkbox
              label="Debug"
              checked={debug}
              onChange={() => {
                setDebug(!debug);
                setQuery({ debug: !debug });
              }}
            />
            <Select
              label="Select your environment"
              defaultValue={"prd"}
              value={env}
              data={ENVIRONMENTS}
              onChange={(e) => {
                if (isCoveoEnvironment(e)) {
                  setEnv(e);
                  setQuery({ env: e });
                }
              }}
            />
            <NumberInput
              label="Tick speed"
              value={tickSpeed}
              onChange={(e) => {
                if (isNumber(e)) {
                  setTickSpeed(e);
                  setQuery({ tickSpeed: e });
                }
              }}
            />
            <NumberInput
              label="Number of animations"
              value={numberOfAnimation}
              onChange={(e) => {
                if (isNumber(e)) {
                  setNumberOfAnimation(e);
                  setQuery({ numAnimation: e });
                }
              }}
            />
            <NumberInput
              label="Flight time"
              value={flightTime}
              onChange={(e) => {
                if (isNumber(e)) {
                  setFlightTime(e);
                  setQuery({ flightTime: e });
                }
              }}
            />
            <NumberInput
              label="Arc relative length"
              value={arcRelativeLength}
              onChange={(e) => {
                if (isNumber(e)) {
                  setArcRelativeLength(e);
                  setQuery({ arcRelLength: e });
                }
              }}
              precision={2}
              step={0.1}
              min={0}
            />
            <NumberInput
              label="Arc dash gap"
              value={arcDashGap}
              onChange={(e) => {
                if (isNumber(e)) {
                  setArcDashGap(e);
                  setQuery({ arcDashGap: e });
                }
              }}
              precision={2}
              step={0.1}
              min={0}
            />

            <NumberInput
              label="Arc altitude"
              value={arcAltitudeAutoScale}
              onChange={(e) => {
                if (isNumber(e)) {
                  setArcAltitudeAutoScale(e);
                  setQuery({ arcAltitude: e });
                }
              }}
              precision={2}
              step={0.1}
              min={0}
            />
            <NumberInput
              label="Ring radius"
              value={ringRadius}
              onChange={(e) => {
                if (isNumber(e)) {
                  setRingRadius(e);
                  setQuery({ ringRadius: e });
                }
              }}
            />
            <NumberInput
              label="Ring speed"
              value={ringSpeed}
              onChange={(e) => {
                if (isNumber(e)) {
                  setRingSpeed(e);
                  setQuery({ ringSpeed: e });
                }
              }}
            />
            <NumberInput
              label="Number of rings"
              value={numRings}
              onChange={(e) => {
                if (isNumber(e)) {
                  setNumRings(e);
                  setQuery({ numRings: e });
                }
              }}
            />
            <NumberInput
              label="Atmosphere altitude"
              value={atmosphereAltitude}
              onChange={(e) => {
                if (isNumber(e)) {
                  setAtmosphereAltitude(e);
                  setQuery({ atmosphereAltitude: e });
                }
              }}
              precision={2}
              step={0.1}
              min={0}
            />
          </ScrollArea>
        </Stack>
      </Drawer>

      <AnimatedGlobe
        autoRotate={rotate}
        renderRings={renderRings}
        renderArcs={renderArcs}
        renderLabels={renderLabels}
        anim={animate}
        debug={debug}
        tickSpeed={tickSpeed}
        numRings={numRings}
        flightTime={flightTime}
        arcRelativeLength={arcRelativeLength}
        ringRadius={ringRadius}
        ringSpeed={ringSpeed}
        numberOfAnimation={numberOfAnimation}
        arcDashGap={arcDashGap}
        atmosphereAltitude={atmosphereAltitude}
        arcAltitudeAutoScale={arcAltitudeAutoScale}
        env={env}
      />
    </div>
  );
};
