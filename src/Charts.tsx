/* eslint-disable */

import { FunctionComponent, useEffect, useState, useRef } from "react";
import "chart.js/auto"; // ADD THIS
import { Grid, ScrollArea, Space, Stack, Text } from "@mantine/core";
import {
    CoveoEnvironment,
    DailyMetrics,
    DailyMetricsResponse,
    envRegionMapping,
    isCoveoEnvironment,
    LiveEvent,
    MinutelyMetrics,
    MinutelyMetricsResponse,
    normalizeCoveoEnvironment,
    RealTimeMetricsResponse,
    ValidRegions,
} from "./Events";
import axios, { AxiosInstance } from "axios";
import { StringParam, useQueryParams } from "use-query-params";
import CountUp from 'react-countup';
import {aggregateDaily, aggregateMinutely, blackFriday, dayDiff, emptyDaily, emptyMinutely, plusDays} from "./utils";

const calculateBfcmDay = (date: Date): number => {
    const delta = dayDiff(blackFriday(date.getUTCFullYear()), date);
    return delta < 0 || delta > 4 ? -1 : delta;
};

const calculatePreviousDays = (date: Readonly<Date>, bfcmDay: number): string[] => {
    if (bfcmDay < 1) {
        return [];
    }
    const pastDays: string[] = new Array(bfcmDay);
    const thanksgiving = blackFriday(date.getUTCFullYear());
    for (let day = 0; day < bfcmDay; ++day) {
        pastDays[day] = plusDays(thanksgiving, 1 + day).toISOString().substring(0, 10);
    }

    return pastDays;
}

const lastMinute = (): Date => {
    const date = new Date();
    date.setMilliseconds(0);
    date.setSeconds(0);
    date.setMinutes(date.getMinutes() - 1);
    return date;
}

export interface ChartsProps {
    tickSpeed?: number;
}

const lambdaClient: AxiosInstance = axios.create();

const USDollar = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
});

const numberFormat = new Intl.NumberFormat('en-US');
const secondsFormat = new Intl.NumberFormat('en-US', {style: 'unit', unit: 'second', maximumFractionDigits: 1, unitDisplay: 'long'});
const regionNameFormat = new Intl.DisplayNames('en-US', {type: 'region'});

const EMPTY_DAILY = Object.freeze(emptyDaily());
const EMPTY_MINUTELY = Object.freeze(emptyMinutely());

const purchasesPerCountryToMap = (purchasesPerCountry: Record<string, number>): Map<string, number> => {
    const result = new Map();
    const countries = Object.keys(purchasesPerCountry);
    countries.sort((a, b) => purchasesPerCountry[b] - purchasesPerCountry[a]);

    for (const country of countries) {
        result.set(country, purchasesPerCountry[country]);
    }

    return result;
}

// Normalize the response until the lambda is updated everywhere.
const normalizeResponse = <T extends DailyMetricsResponse | MinutelyMetricsResponse>(response: T): T['metrics'] => {
    if (Array.isArray(response)) {
        return response.reduce((obj, metric: {type: keyof T, count: number}) => {
            obj[metric.type] = metric.count;
            return obj;
        }, {});
    }
    return response.metrics;
}

export const Charts: FunctionComponent<ChartsProps> = (props) => {
    const [latencyPerRegion, setLatencyPerRegion] = useState<Partial<Record<ValidRegions, number>>>({});
    const [dailyMetrics, setDailyMetrics] = useState<Readonly<DailyMetrics>>(EMPTY_DAILY);
    const [minutelyMetrics, setMinutelyMetrics] = useState<Readonly<MinutelyMetrics>>(EMPTY_MINUTELY);

    const prevDailyMetricsRef = useRef(dailyMetrics);
    const [purchasesPerCountry, setPurchasesPerCountry] = useState<Readonly<Map<string, number>>>(new Map());

    const [bfcmDay, setBfcmDay] = useState<number>(-1);
    const [bfcmPreviousDays, setBfcmPreviousDays] = useState<ReadonlyArray<Partial<Readonly<DailyMetrics>>>>();
    const [bfcmMetrics, setBfcmMetrics] = useState<DailyMetrics>(EMPTY_DAILY);
    const prevBfcmRevenueRef = useRef(0);

    const [animationTick, setAnimationTick] = useState(0);

    const [query] = useQueryParams({
        env: StringParam,
    });

    const [env, setEnv] = useState<CoveoEnvironment>(normalizeCoveoEnvironment(query.env));

    useEffect(() => {
        if (query.env !== env) {
            if (isCoveoEnvironment(query.env)) {
                console.log("environment is now: ", query.env)
            } else {
                console.log("environment set to default: prd")
            }
            setEnv(normalizeCoveoEnvironment(query.env));
        }
    }, [query.env, env])

    useEffect(() => {
        prevDailyMetricsRef.current = dailyMetrics;
    }, [dailyMetrics]);

    useEffect(() => {
        prevBfcmRevenueRef.current = bfcmMetrics.revenue;
    }, [bfcmMetrics]);

    const getMetrics = async () => {
        const metricsDate = lastMinute();
        const timeBucketMinute = metricsDate.toISOString().substring(0, 16);
        const timeBucketDay = timeBucketMinute.substring(0, 10);

        const minutelyMetricsPerRegion = await Promise.all(envRegionMapping[env].map(async (regionConfig) => {
            const response = await lambdaClient.get<MinutelyMetricsResponse>(`${regionConfig.lambdaEndpoint}&timeBucket=${timeBucketMinute}`);
            return normalizeResponse(response.data);
        }));
        const dailyMetricsPerRegion = await Promise.all(envRegionMapping[env].map(async (regionConfig) => {
            const response = await lambdaClient.get<DailyMetricsResponse>(`${regionConfig.lambdaEndpoint}&timeBucket=${timeBucketDay}`);
            return normalizeResponse(response.data);
        }));

        const minutelyMetrics = aggregateMinutely(minutelyMetricsPerRegion);
        const dailyMetrics = aggregateDaily(dailyMetricsPerRegion);

        setDailyMetrics(dailyMetrics);
        setMinutelyMetrics(minutelyMetrics);
        setPurchasesPerCountry(purchasesPerCountryToMap(dailyMetrics.purchasesPerCountry));

        const metricsBfcmDay = calculateBfcmDay(metricsDate);
        let pastMetrics = bfcmPreviousDays;
        if (metricsBfcmDay != bfcmDay) {
            setBfcmDay(metricsBfcmDay);

            if (metricsBfcmDay < 0) {
                if (bfcmPreviousDays) {
                    setBfcmPreviousDays(undefined);
                }
            } else if (bfcmPreviousDays?.length != metricsBfcmDay) {
                const pastDays = calculatePreviousDays(metricsDate, metricsBfcmDay);
                const pastMetricsResponses = await Promise.all(pastDays.flatMap((day) => {
                    return envRegionMapping[env].map(regionConfig =>
                        lambdaClient.get<DailyMetricsResponse>(`${regionConfig.lambdaEndpoint}&timeBucket=${day}`)
                    )
                }));
                pastMetrics = pastMetricsResponses.map((response) => normalizeResponse(response.data));
                setBfcmPreviousDays(pastMetrics);
            }
        }
        if (metricsBfcmDay >= 0) {
            setBfcmMetrics(pastMetrics && (pastMetrics.length > 0) ? aggregateDaily(pastMetrics.concat(dailyMetrics)): dailyMetrics);
        }
    };

    const getEvents = async () => {
        const latency: Partial<Record<ValidRegions, number>> = {};
        const now = Date.now();

        const eventsPerRegion = await Promise.all(envRegionMapping[env].map(async ({lambdaEndpoint, region}) => {
            const events = await lambdaClient
                .get<RealTimeMetricsResponse>(`${lambdaEndpoint}&last=${props.tickSpeed}`)
                .then((res) => (Array.isArray(res.data) ? res.data as LiveEvent[] : res.data.items), (e) => {
                    console.error(e);
                    const liveEvent: LiveEvent = {
                        city: "",
                        country: "",
                        eventType: "",
                        event_id: "",
                        inserted_at: 0,
                        lat: "",
                        lng: "",
                        region: region,
                        timestamp: 0,
                        type: "",
                    };
                    return [liveEvent];
                });

            if (events.length > 0) {
                const total = events.reduce((previous, {timestamp}) => {
                    return previous + (now - timestamp);
                }, 0);
                const mean = total / events.length;
                latency[region] = mean / 1000;
            }

            return events;
        }));

        setLatencyPerRegion(latency);

        return eventsPerRegion;
    };

    useEffect(() => {
        const timeout = setInterval(() => {
            getEvents();
    
            setAnimationTick(animationTick + 1);
        }, props.tickSpeed);
        return () => {
            clearInterval(timeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animationTick]);

    useEffect(() => {
        getMetrics()
        const timeout = setInterval(async () => {
            getMetrics()
        }, 60000);
        return () => {
            clearInterval(timeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [env, bfcmPreviousDays]);

    return (
        <>
            <Grid style={{
                position: "fixed",
                top: 100,
                padding: 10,
                zIndex: 2,
                width: "80%",
                height: 100,
                left: "20%"
            }}>
                <Grid.Col span={4} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Total sales today (USD)</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>
                        <CountUp
                            start={prevDailyMetricsRef.current.revenue}
                            end={dailyMetrics.revenue}
                            duration={10}
                            separator=","
                            decimal="."
                            decimals={0}
                            prefix="$"
                        />
                    </Text>
                </Grid.Col>
                <Grid.Col span={4} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Total add to cart today</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>
                        <CountUp
                            start={prevDailyMetricsRef.current.addToCart}
                            end={dailyMetrics.addToCart}
                            duration={10}
                            separator=","
                        />
                    </Text>
                </Grid.Col>
                <Grid.Col span={4} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Total purchases today</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>
                        <CountUp
                            start={prevDailyMetricsRef.current.purchases}
                            end={dailyMetrics.purchases}
                            duration={10}
                            separator=","
                        />
                    </Text>
                </Grid.Col>
            </Grid>
            {bfcmDay >= 0 && <Grid style={{
                position: "fixed",
                top: "40%",
                padding: 10,
                zIndex: 5,
                width: "80%",
                left: "10%"
            }}>
                <Grid.Col span={10} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text color={"white"} style={{ fontSize: "xxx-large" }}>BFCM sales (USD)</Text>
                    <Text weight="bold" style={{ fontSize: "xxx-large" }}>
                        <CountUp
                            start={prevBfcmRevenueRef.current}
                            end={bfcmMetrics.revenue}
                            duration={10}
                            separator=","
                            decimal="."
                            decimals={0}
                            prefix="$"
                        />
                    </Text>
                </Grid.Col>
            </Grid> }
            { purchasesPerCountry?.size && 
                <Stack align="center" justify="flex-start" spacing="xs" style={{
                    position: "fixed",
                    display: "block",
                    top:"25%",
                    right: "5%",
                    height: 100,
                    bottom: "35%",
                    zIndex: 4,
                }}>
                        <Text size="xl" color={"darkgrey"}>Purchases per country today</Text>
                        <div style= {{ height: "100%", display: "block" }}>
                        {/* <Marquee direction={"up"} style={{ width:"80%" }}> */}
                            <ScrollArea style={{ height: 400 }}>
                            { Array.from(purchasesPerCountry.entries(), ([countryCode, count]) =>
                                <div key={"country_" + countryCode}>
                                    <Text style={{ fontSize: "xx-large" }} color={"white"}>{regionNameFormat.of(countryCode)}</Text>
                                    <Space w="xs"/>
                                    <Text style={{ fontSize: "xx-large" }} color={"green"} weight="bold">{numberFormat.format(count)}</Text>
                                </div>
                            )}
                            </ScrollArea>
                        {/* </Marquee> */}
                        </div>
                </Stack> }

            <Grid style={{
                position: "fixed",
                bottom: "15%",
                padding: 10,
                zIndex: 2,
                width: "100%",
                left: "5%",
                height: 100,
            }}>
                <Grid.Col span={3} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Sales last minute (USD)</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>{USDollar.format(minutelyMetrics.revenue)}</Text>
                </Grid.Col>
                <Grid.Col span={3} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Add to cart last minute</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>{numberFormat.format(minutelyMetrics.addToCart)}</Text>
                </Grid.Col>
                <Grid.Col span={3} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Purchases last minute</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>{numberFormat.format(minutelyMetrics.purchases)}</Text>
                </Grid.Col>
                <Grid.Col span={3} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Sessions last minute</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>{numberFormat.format(minutelyMetrics.uniqueUsers)}</Text>
                </Grid.Col>
            </Grid>

            <div style={{
                position: "fixed",
                bottom: 0,
                padding: 10,
                zIndex: 2,
                width: "420px",
                height: 120,
                left: 0
            }}>
                <Text color="white" weight={"bold"}>Metrics Latency</Text>

                <Grid>
                    {envRegionMapping[env].map(({region}) => {
                        const latency = latencyPerRegion[region];
                        return (<Grid.Col key={region} span={3} style={{ color: "white" }}>
                            <Text size={14} color="white">
                                {region}
                            </Text>
                            <Text
                                size="sm"
                                color={
                                    latency == undefined || latency === 0
                                        ? "grey"
                                        : latency < 5
                                            ? "green"
                                            : latency < 20
                                                ? "yellow"
                                                : "red"
                                }
                            >
                                {latency == undefined ? "(No events)" : secondsFormat.format(latency)}
                            </Text>
                        </Grid.Col>);
                    })}
                </Grid>
            </div>
        </>
    );
};
