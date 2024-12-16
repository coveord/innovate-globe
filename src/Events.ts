export type CoveoEnvironment = "dev" | "stg" | "prd";
export const isCoveoEnvironment = (value: unknown): value is CoveoEnvironment =>
    typeof value === 'string' && /dev|stg|prd/.test(value);

export const normalizeCoveoEnvironment = (value: unknown): CoveoEnvironment =>
    isCoveoEnvironment(value) ? value : 'prd';

export type ValidRegions = "us-east-1" | "us-east-2" | "eu-west-1" | "ap-southeast-2" | "ca-central-1";

export type MetricType = 'real-time' | 'minutely' | 'daily';

export interface LiveEvent {
    city: string;
    country: string;
    eventType: string;
    event_id: string;
    inserted_at: number;
    lat: string;
    lng: string;
    region: ValidRegions;
    timestamp: number;
    type: string;
    productAction?: string;
    price?: string | number;
}

export interface MetricsResponse {
    type: MetricType;
}

export interface RealTimeMetricsResponse extends MetricsResponse {
    type: 'real-time';
    items: LiveEvent[];
}

export interface CommonMetrics {
    addToCart: number;
    purchases: number;
    revenue: number;
}

export interface DailyMetrics extends CommonMetrics {
    purchasesPerCountry: Record<string, number>;
}

export interface MinutelyMetrics extends CommonMetrics {
    uniqueUsers: number;
}

export interface DailyMetricsResponse extends MetricsResponse {
    type: 'daily';
    metrics: Partial<DailyMetrics>;
}

export interface MinutelyMetricsResponse extends MetricsResponse {
    type: 'minutely';
    metrics: Partial<MinutelyMetrics>;
}

export const AWSRegionGeo = Object.freeze({
    "us-east-1": {
        lat: 37.926868,
        lng: -78.024902,
    },
    "us-east-2": {
        lat: 39.962222,
        lng: -83.000556,
    },
    "eu-west-1": {
        lat: 53.350140,
        lng: 6.2603,
    },
    "ap-southeast-2": {
        lat: -33.865143,
        lng: 151.2099,
    },
    "ca-central-1": {
        lat: 45.502079010009766,
        lng: -73.56201171875,
    },
});

export const envRegionMapping = Object.freeze<Record<CoveoEnvironment, Array<{region: ValidRegions, lambdaEndpoint: string}>>>({
    dev: [
        {
            region: "us-east-1",
            lambdaEndpoint: `https://gdattsifnijqe42uhkuv4oi5nm0fhbxc.lambda-url.us-east-1.on.aws/?password=${localStorage.getItem(
                "pw"
            )}`
        },
        {
            region: "eu-west-1",
            lambdaEndpoint: `https://rh56syu7nuc2glmihqjf76ol2a0owecb.lambda-url.eu-west-1.on.aws/?password=${localStorage.getItem(
                "pw"
            )}`
        }
    ],
    stg: [
        {
            region: "us-east-2",
            lambdaEndpoint: `https://musf6glaozilpayrn7xlr44j7y0shnct.lambda-url.us-east-2.on.aws/?password=${localStorage.getItem(
                "pw"
            )}`
        }
    ],
    prd: [
        {
            region: "us-east-1",
            lambdaEndpoint: `https://rha5ieunhnmgc3d4xtsow4dj240mggtt.lambda-url.us-east-1.on.aws/?password=${localStorage.getItem(
                "pw"
            )}`
        },
        {
            region: "eu-west-1",
            lambdaEndpoint: `https://c6xdcpmacp66i4njcrrwatb73i0opcjr.lambda-url.eu-west-1.on.aws/?password=${localStorage.getItem(
                "pw"
            )}`
        },
        {
            region: "ap-southeast-2",
            lambdaEndpoint: `https://72fup7tch7frsprfdvbctvaiv40sommb.lambda-url.ap-southeast-2.on.aws/?password=${localStorage.getItem(
                "pw"
            )}`
        },
        {
            region: "ca-central-1",
            lambdaEndpoint: `https://bmhvpjqu6axz5sybivpkt4j4oy0maebe.lambda-url.ca-central-1.on.aws/?password=${localStorage.getItem(
                "pw"
            )}`
        }
    ]
});
