/* eslint-disable */

import { FunctionComponent, useEffect, useState, useRef } from "react";
import "chart.js/auto"; // ADD THIS
import { Grid, ScrollArea, Space, Stack, Text, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import {
    CoveoEnvironment,
    envRegionMapping,
    isCoveoEnvironment,
    LiveEvent,
    normalizeCoveoEnvironment,
    TimeBucketMetric,
    ValidRegions,
} from "./Events";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { StringParam, useQueryParams } from "use-query-params";
import CountUp from 'react-countup';

export interface ChartsProps {
    tickSpeed?: number;
}

function onBFCMWeekend(day: string) {
    return bfcmDays.includes(day);
}

function daysInPastOfBfcmWeekend(day: string) {
    const currentDayIndex = bfcmDays.indexOf(day);
    return bfcmDays.slice(0, currentDayIndex);
}

const lambdaClient: AxiosInstance = axios.create();

const USDollar = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

const numberFormat = new Intl.NumberFormat('en-US');

const secondsFormat = new Intl.NumberFormat('en-US', {style: 'unit', unit: 'second', maximumFractionDigits: 1, unitDisplay: 'long'});

const bfcmDays = Object.freeze(["2024-11-29", "2024-11-30", "2024-12-01", "2024-12-02"]);
let isBFCMWeekend = false;

export const Charts: FunctionComponent<ChartsProps> = (props) => {
    const [us1Latency, setUs1Latency] = useState<number>(0);
    const [us2Latency, setUs2Latency] = useState<number>(0);
    const [euLatency, setEuLatency] = useState<number>(0);
    const [apLatency, setApLatency] = useState<number>(0);
    const [caLatency, setCaLatency] = useState<number>(0);

    const [purchasesPerMinute, setPurchasesPerMinute] = useState<number>(0);
    const [revenuePerMinute, setRevenuePerMinute] = useState<number>(0);
    const [addToCartsPerMinute, setAddToCartsPerMinute] = useState<number>(0);
    const [uniqueUsersPerMinute, setUniqueUsersPerMinute] = useState<number>(0);

    const prevPurchaseStateRef = useRef(0);
    const prevRevenueStateRef = useRef(0);
    const prevAddToCartStateRef = useRef(0);
    const [purchasesPerDay, setPurchasesPerDay] = useState<number>(0);
    const [revenuePerDay, setRevenuePerDay] = useState<number>(0);
    const [addToCartsPerDay, setAddToCartsPerDay] = useState<number>(0);
    const [eventsPerCountry, setEventsPerCountry] = useState<Map<string, number>>(new Map());

    const prevBfcmRevenueRef = useRef(0);
    const [bfcmRevenue, setBfcmRevenue] = useState<number>(0);

    const [animationTick, setAnimationTick] = useState(0);

    const [query] = useQueryParams({
        env: StringParam,
    });

    const [env, setEnv] = useState<CoveoEnvironment>(normalizeCoveoEnvironment(query.env));

    const regionsInEnv = envRegionMapping[env].map(regionConfig => regionConfig.region);

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
        prevPurchaseStateRef.current = purchasesPerDay;
    }, [purchasesPerDay]);

    useEffect(() => {
        prevRevenueStateRef.current = revenuePerDay;
    }, [revenuePerDay]);

    useEffect(() => {
        prevAddToCartStateRef.current = addToCartsPerDay;
    }, [addToCartsPerDay]);

    useEffect(() => {
        prevBfcmRevenueRef.current = bfcmRevenue;
    }, [bfcmRevenue]);

    const getMetrics = async () => {
        let purchasesPerMinuteAcrossRegions = 0;
        let revenuePerMinuteAcrossRegions = 0;
        let addToCartsPerMinuteAcrossRegions = 0;
        let uniqueUsersPerMinuteAcrossRegions = 0;

        let purchasesPerDayAcrossRegions = 0;
        let revenuePerDayAcrossRegions = 0;
        let addToCartsPerDayAcrossRegions = 0;

        let arrayPromises: Array<Promise<AxiosResponse<TimeBucketMetric[]>>> = [];
        let currentdate = new Date();
        let currentMinute = currentdate.getMinutes();
        currentdate.setMilliseconds(0);
        currentdate.setSeconds(0);
        currentdate.setMinutes(currentMinute - 1);
        let currentDay = currentdate.toISOString().split('T')[0];
        isBFCMWeekend = onBFCMWeekend(currentDay);

        for (const regionConfig of envRegionMapping[env]) {
            arrayPromises.push(lambdaClient
                .get<TimeBucketMetric[]>(`${regionConfig.lambdaEndpoint}&timeBucket=${currentdate.toISOString()}&timeBucketType=minutely`).catch((e) => {
                    console.log("Caught an error calling the lambda", e);
                    return new Promise(() => { return {"data":[]}});
                }));
            arrayPromises.push(lambdaClient
                .get<TimeBucketMetric[]>(`${regionConfig.lambdaEndpoint}&timeBucket=${currentDay}&timeBucketType=daily`));
        }
        for (const response of await Promise.all(arrayPromises)) {
            if (!Array.isArray(response.data)) {
                continue;
            }

            const metrics = response.data;
            metrics.forEach((metric: TimeBucketMetric) => {
                const value = +metric.count || 0;
                if (metric.timeBucketType === 'minutely') {
                    switch (metric.type) {
                        case 'purchases':
                            purchasesPerMinuteAcrossRegions += value;
                            break;
                        case 'revenue':
                            revenuePerMinuteAcrossRegions += value;
                            break;
                        case 'addToCart':
                            addToCartsPerMinuteAcrossRegions += value;
                            break;
                        case 'uniqueUsers':
                            uniqueUsersPerMinuteAcrossRegions += value;
                            break;
                    }
                } else if (metric.timeBucketType === 'daily') {
                    switch (metric.type) {
                        case 'purchases':
                            purchasesPerDayAcrossRegions += value;
                            break;
                        case 'revenue':
                            revenuePerDayAcrossRegions += value;
                            break;
                        case 'addToCart':
                            addToCartsPerDayAcrossRegions += value;
                            break;
                    }
                }
            })
        }
        setPurchasesPerMinute(purchasesPerMinuteAcrossRegions);
        setRevenuePerMinute(revenuePerMinuteAcrossRegions);
        setAddToCartsPerMinute(addToCartsPerMinuteAcrossRegions);
        setUniqueUsersPerMinute(uniqueUsersPerMinuteAcrossRegions);

        setPurchasesPerDay(purchasesPerDayAcrossRegions);
        setRevenuePerDay(revenuePerDayAcrossRegions);
        setAddToCartsPerDay(addToCartsPerDayAcrossRegions);

        if (isBFCMWeekend) {
            arrayPromises = [];
            let totalBfcmRevenue = revenuePerDayAcrossRegions;
            const bfcmWeekend = daysInPastOfBfcmWeekend(currentDay);
            for (const bfcmDay of bfcmWeekend) {
                for (const regionConfig of envRegionMapping[env]) {
                    arrayPromises.push(lambdaClient
                        .get<TimeBucketMetric[]>(`${regionConfig.lambdaEndpoint}&timeBucket=${bfcmDay}&timeBucketType=daily`));
                }
                for (const promise of await Promise.all(arrayPromises)) {
                    if (!Array.isArray(promise.data)) {
                        continue;
                    }
                    promise.data.forEach((metric) => {
                        if (metric.timeBucketType === 'daily' && metric.type === 'revenue') {
                            totalBfcmRevenue += Number(metric.count);
                        }
                    });
                }
            }
            setBfcmRevenue(totalBfcmRevenue);
        }
    };

    const getEvents = envRegionMapping[env].map(({lambdaEndpoint, region}) => async () => {
        const events = await lambdaClient
            .get<LiveEvent[]>(`${lambdaEndpoint}&last=${props.tickSpeed}`)
            .then((res) => res.data, (e) => {
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

        if (events?.length > 0) {
            const countriesChanged = events.reduce((_, {eventType, country}) => {
                if (country && eventType == "purchase") {
                    eventsPerCountry.set(country, (eventsPerCountry.get(country) ?? 0) + 1);
                    return true;
                }
                return false;
            }, false);
            if (countriesChanged) {
                // Note: map updated in-place, but set it to invalidate the state.
                setEventsPerCountry(eventsPerCountry);
                
            }
            const now = Date.now();
            const total = events.reduce((previous, {timestamp}) => {
                return previous + (now - timestamp);
            }, 0);
            const mean = total / events.length;
            const latency = mean / 1000;
            switch (region) {
                case "us-east-1":
                    setUs1Latency(latency);
                    break;

                case "us-east-2":
                    setUs2Latency(latency);
                    break;

                case "eu-west-1":
                    setEuLatency(latency);
                    break;

                case "ap-southeast-2":
                    setApLatency(latency);
                    break;

                case "ca-central-1":
                    setCaLatency(latency);
                    break;

                default:
                    console.log("Region not valid- {}", region);
                    break;
            }
        }
    });

    useEffect(() => {
        const timeout = setInterval(async () => {
            await Promise.all(getEvents.map(getEvent => getEvent()));
    
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
    }, [env]);

    const regionLatency: Record<ValidRegions, number> = {
        "us-east-1": us1Latency,
        "us-east-2": us2Latency,
        "eu-west-1": euLatency,
        "ap-southeast-2": apLatency,
        "ca-central-1": caLatency
    }

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
                            start={prevRevenueStateRef.current}
                            end={revenuePerDay}
                            duration={10}
                            separator=","
                            decimal="."
                            decimals={2}
                            prefix="$"
                        />
                    </Text>
                </Grid.Col>
                <Grid.Col span={4} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Total add to cart today</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>
                        <CountUp
                            start={prevAddToCartStateRef.current}
                            end={addToCartsPerDay}
                            duration={10}
                            separator=","
                        />
                    </Text>
                </Grid.Col>
                <Grid.Col span={4} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Total transactions today</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>
                        <CountUp
                            start={prevPurchaseStateRef.current}
                            end={purchasesPerDay}
                            duration={10}
                            separator=","
                        />
                    </Text>
                </Grid.Col>
            </Grid>
            {isBFCMWeekend && <Grid style={{
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
                            end={bfcmRevenue}
                            duration={10}
                            separator=","
                            decimal="."
                            decimals={2}
                            prefix="$"
                        />
                    </Text>
                </Grid.Col>
            </Grid> }
            { eventsPerCountry?.size && 
                <Stack align="center" justify="flex-start" spacing="xs" style={{
                    position: "fixed",
                    display: "block",
                    top:"25%",
                    right: "5%",
                    height: 100,
                    bottom: "35%",
                    zIndex: 4,
                }}>
                        <Text size="xl" color={"darkgrey"}>Purchases per Country
                            <Tooltip label="Purchases per country is tallied starting on page load">
                                <IconInfoCircle/>
                            </Tooltip>
                        </Text>
                        <div style= {{ height: "100%", display: "block" }}>
                        {/* <Marquee direction={"up"} style={{ width:"80%" }}> */}
                            <ScrollArea style={{ height: 400 }}>
                            { [... eventsPerCountry].sort((a: [string, number], b: [string, number]) => a[1] - b[1]).reverse().map(([country, count]) =>
                                <div>
                                    <Text style={{ fontSize: "xx-large" }} color={"white"}>{country}</Text>
                                    <Space w="xs"/>
                                    <Text style={{ fontSize: "xx-large" }} color={"green"} weight="bold">{count}</Text>
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
                    <Text size="xl" color={"darkgrey"}>Sales per minute (USD)</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>{USDollar.format(revenuePerMinute)}</Text>
                </Grid.Col>
                <Grid.Col span={3} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Add to cart per minute</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>{numberFormat.format(addToCartsPerMinute)}</Text>
                </Grid.Col>
                <Grid.Col span={3} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Transactions per minute</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>{numberFormat.format(purchasesPerMinute)}</Text>
                </Grid.Col>
                <Grid.Col span={3} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Unique users per minute</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>{numberFormat.format(uniqueUsersPerMinute)}</Text>
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
                <Text color="white" weight={"bold"}>Latency</Text>

                <Grid>
                    { regionsInEnv.map((region) => 
                        <Grid.Col span={3} style={{ color: "white" }}>
                            <Text size={14} color="white">
                                {region}
                            </Text>
                            <Text
                                size="sm"
                                color={
                                    regionLatency[region] === 0
                                        ? "grey"
                                        : regionLatency[region] < 5
                                            ? "green"
                                            : regionLatency[region] < 20
                                                ? "yellow"
                                                : "red"
                                }
                            >
                                {secondsFormat.format(regionLatency[region])}
                            </Text>
                        </Grid.Col>
                    )}
                </Grid>
            </div>
        </>
    );
};
