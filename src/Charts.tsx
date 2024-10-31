/* eslint-disable */

import { FunctionComponent, useEffect, useState, useRef } from "react";
import "chart.js/auto"; // ADD THIS
import { Grid, Text } from "@mantine/core";
import {
    envRegionMapping,
    LiveEvent,
    TimeBucketMetric,
} from "./Events";
import axios, { AxiosInstance } from "axios";
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

const bfcmDays = ["2024-11-29", "2024-11-30", "2024-12-01", "2024-12-02"];
var isBFCMWeekend = false;

export const Charts: FunctionComponent<ChartsProps> = (props) => {
    const [us1Latency, setUs1Latency] = useState<number>(0);
    const [us2Latency, setUs2Latency] = useState<number>(0);
    const [euLatency, setEuLatency] = useState<number>(0);
    const [apLatency, setApLatency] = useState<number>(0);
    const [caLatency, setCaLatency] = useState<number>(0);
    const [countries, setCountries] = useState(new Map());

    const updateCountries = (countriesToUpdate: Map<string, number>) => {
        const updatedCountries = countries;
        countriesToUpdate.forEach((count:number, country:string) => {
            if (updatedCountries.has(country)) {
                updatedCountries.set(country, updatedCountries.get(country)count;
            }
        })
        setCountries(updatedCountries);
    }

    const [purchasesPerMinute, setPurchasesPerMinute] = useState<number>(0);
    const [revenuePerMinute, setRevenuePerMinute] = useState<number>(0);
    const [addToCartsPerMinute, setAddToCartsPerMinute] = useState<number>(0);

    const prevPurchaseStateRef = useRef(0);
    const prevRevenueStateRef = useRef(0);
    const prevAddToCartStateRef = useRef(0);
    const [purchasesPerDay, setPurchasesPerDay] = useState<number>(0);
    const [revenuePerDay, setRevenuePerDay] = useState<number>(0);
    const [addToCartsPerDay, setAddToCartsPerDay] = useState<number>(0);

    const prevBfcmRevenueRef = useRef(0);
    const [bfcmRevenue, setBfcmRevenue] = useState<number>(0);

    const [animationTick, setAnimationTick] = useState(0);

    const [query] = useQueryParams({
        env: StringParam,
    });

    const [env, setEnv] = useState<string>(
        force(query.env, "prd")
    );

    var regionsInEnv: string[] = envRegionMapping[env].map((regionConfig: any) => {
        return regionConfig["region"]
    });;

    useEffect(() => {
        if (query.env !== env && query.env) {
            console.log("environment is now: ", query.env)
            setEnv(query.env!);
            regionsInEnv = envRegionMapping[env].map((regionConfig: any) => {
                return regionConfig["region"]
            });
        } else if (query.env !== env){
            console.log("environment set to default: prd")
            setEnv("prd");
            regionsInEnv = envRegionMapping[env].map((regionConfig: any) => {
                return regionConfig["region"]
            });
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

    function force<T>(v: T | null | undefined, fallback: T): T {
        return v !== null && v !== undefined ? v : fallback;
    }

    const getMetrics = async () => {
        if (!query.env) {
            query.env = "prd";
        }
        if (query.env) {
            var purchasesPerMinuteAcrossRegions = 0;
            var revenuePerMinuteAcrossRegions = 0;
            var addToCartsPerMinuteAcrossRegions = 0;

            var purchasesPerDayAcrossRegions = 0;
            var revenuePerDayAcrossRegions = 0;
            var addToCartsPerDayAcrossRegions = 0;

            var arrayPromises:any = [];
            var currentdate = new Date();
            var currentMinute = currentdate.getMinutes();
            currentdate.setMilliseconds(0);
            currentdate.setSeconds(0);
            currentdate.setMinutes(currentMinute - 1);
            var currentDay = currentdate.toISOString().split('T')[0];
            isBFCMWeekend = onBFCMWeekend(currentDay);

            for (const regionConfig of envRegionMapping[query.env]) {
                arrayPromises.push(await lambdaClient
                    .get<TimeBucketMetric[]>(`${regionConfig.lambdaEndpoint}&timeBucket=${currentdate.toISOString()}&timeBucketType=minutely`).catch((e) => {
                        console.log("Caught an error calling the lambda", e);
                        return new Promise(() => { return {"data":[]}});
                    }));
                arrayPromises.push(await lambdaClient
                    .get<TimeBucketMetric[]>(`${regionConfig.lambdaEndpoint}&timeBucket=${currentDay}&timeBucketType=daily`));
            }
            await Promise.all(arrayPromises);
            for (const promise of arrayPromises) {
                if (Array.isArray(promise.data)) {
                    const metrics = promise.data;
                    metrics.forEach((metric: TimeBucketMetric) => {
                        if (metric.timeBucketType === 'minutely') {
                            if (metric.type === 'purchases') {
                                purchasesPerMinuteAcrossRegions += Number(metric.count);
                            }
                            if (metric.type === 'revenue') {
                                revenuePerMinuteAcrossRegions += Number(metric.count);
                            }
                            if (metric.type === 'addToCart') {
                                addToCartsPerMinuteAcrossRegions += Number(metric.count);
                            }
                        } else if (metric.timeBucketType === 'daily') {
                            if (metric.type === 'purchases') {
                                purchasesPerDayAcrossRegions += Number(metric.count);
                            }
                            if (metric.type === 'revenue') {
                                revenuePerDayAcrossRegions += Number(metric.count);
                            }
                            if (metric.type === 'addToCart') {
                                addToCartsPerDayAcrossRegions += Number(metric.count);
                            }
                        }
                    })
                }
            }
            setPurchasesPerMinute(purchasesPerMinuteAcrossRegions);
            setRevenuePerMinute(revenuePerMinuteAcrossRegions);
            setAddToCartsPerMinute(addToCartsPerMinuteAcrossRegions);

            setPurchasesPerDay(purchasesPerDayAcrossRegions);
            setRevenuePerDay(revenuePerDayAcrossRegions);
            setAddToCartsPerDay(addToCartsPerDayAcrossRegions);

            if (isBFCMWeekend) {
                var arrayPromises:any = [];
                var totalBfcmRevenue = revenuePerDayAcrossRegions;
                const bfcmWeekend = daysInPastOfBfcmWeekend(currentDay);
                for (const bfcmDay of bfcmWeekend) {
                    for (const regionConfig of envRegionMapping[query.env]) {
                        arrayPromises.push(await lambdaClient
                            .get<TimeBucketMetric[]>(`${regionConfig.lambdaEndpoint}&timeBucket=${bfcmDay}&timeBucketType=daily`));
                    }
                    await Promise.all(arrayPromises);
                    for (const promise of arrayPromises) {
                        if (Array.isArray(promise.data)) {
                            const metrics = promise.data;
                            metrics.forEach((metric: TimeBucketMetric) => {
                                if (metric.timeBucketType === 'daily') {
                                    if (metric.type === 'revenue') {
                                        totalBfcmRevenue += Number(metric.count);
                                    }
                                }
                            })
                        }
                    }
                }
                setBfcmRevenue(totalBfcmRevenue);
            }
        }
    };

    var getEvents: any = [];
    for(const regionConfig of envRegionMapping[env]) {
        const lambdaUrl = regionConfig["lambdaEndpoint"];
        const region = regionConfig["region"];
        getEvents.push(async () => {
            const events = await lambdaClient
                .get<LiveEvent[]>(`${lambdaUrl}&last=${props.tickSpeed}`)
                .then((res) => res.data)
                .catch((e) => {
                    console.log(e);
                    const liveEvent: LiveEvent = {
                        city: "",
                        country: "",
                        event_id: "",
                        inserted_at: 0,
                        lat: "",
                        lng: "",
                        region: "us-east-1",
                        timestamp: 0,
                        type: "",
                    };
                    return [liveEvent];
                });
    
            if (events[0]) {
                const total = events.reduce((previous, current) => {
                    return current.timestamp + previous;
                }, 0);
                const countryCounter = events.map((event) => event.city != '' ? event.city : null).filter(v => v).reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map());
                const mean = total / events.length;
                if(region == "us-east-1") {
                    setUs1Latency(Math.round((new Date().getTime() - mean) / 1000));
                } else if (region == "us-east-2") {
                    setUs2Latency(Math.round((new Date().getTime() - mean) / 1000));
                } else if (region == "eu-west-1") {
                    setEuLatency(Math.round((new Date().getTime() - mean) / 1000));
                } else if (region == "ap-southeast-2") {
                    setApLatency(Math.round((new Date().getTime() - mean) / 1000));
                } else if (region == "ca-central-1") {
                    setCaLatency(Math.round((new Date().getTime() - mean) / 1000));
                } else {
                    console.log("Region not valid- {}", region);
                }
            }
        });
    }

    const emitData = async () => {
        var promiseData: Promise<void>[] = [];
        for(const getEvent of getEvents) {
            promiseData.push(getEvent())
        }

        await Promise.all(promiseData);

        setAnimationTick(animationTick + 1);
    };

    useEffect(() => {
        const timeout = setInterval(async () => {
            await emitData();
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

    let USDollar = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    });

    const regionLatency: Record<string, number> = {
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
            <Grid style={{
                position: "fixed",
                bottom: 100,
                padding: 10,
                zIndex: 2,
                width: "80%",
                height: 100,
                left: "20%"
            }}>
                <Grid.Col span={4} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Sales per minute (USD)</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>{USDollar.format(revenuePerMinute)}</Text>
                </Grid.Col>
                <Grid.Col span={4} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Add to cart per minute</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>{addToCartsPerMinute}</Text>
                </Grid.Col>
                <Grid.Col span={4} style={{ color: "white", borderLeft: "4px solid white" }}>
                    <Text size="xl" color={"darkgrey"}>Transactions per minute</Text>
                    <Text weight="bold" style={{ fontSize: "xx-large" }}>{purchasesPerMinute}</Text>
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
                    { regionsInEnv.map((region: string) => 
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
                                {regionLatency[region].toString()} seconds
                            </Text>
                        </Grid.Col>
                    )}
                </Grid>
            </div>


        </>
    );
};
