import { DailyMetrics, MinutelyMetrics } from "./Events";

const MILLIS_IN_DAY = 24 * 3600000;
/** Cache for calculated holidays. */
const CACHE = new Map<string, Readonly<Date>>();

/**
 * Utility to create a cached calculated holiday resolver.
 *
 * @param suffix The cache suffix, must be unique for all cached calculated holidays.
 * @param calculate The method that calculates the day.
 * @returns The Date representing the holiday.
 */
const cached = (suffix: string, calculate: (year: number) => Date): (year: number) => Readonly<Date> =>
    (year: number) => {
        const k = `${year}-${suffix}`;
        let v = CACHE.get(k);
        if (!v) {
            v = Object.freeze(calculate(year));
            CACHE.set(k, v);
        }
        return v;
    };

/**
 * Add a number of days to a Date, returning a new Date with the result.
 *
 * @param date 
 * @param days 
 * @returns 
 */
export const plusDays = (date: Readonly<Date>, days: number): Date =>
    new Date(date.getTime() + (days * MILLIS_IN_DAY));

/**
 * Calculate the number of full days between two dates, not taking into account DST.
 * If the value is before the anchor, the difference will be negative.
 *
 * @param anchor The date to calculate relative to.
 * @param value The value to compare to.
 * @returns The number of full (24 hour) days.
 */
export const dayDiff = (anchor: Readonly<Date>, value: Readonly<Date>): number =>
    Math.floor((value.getTime() - anchor.getTime()) / MILLIS_IN_DAY);

/**
 * Calculate the day (United States) Thanksgiving falls on in a year.
 *
 * @param year The year.
 * @returns The UTC midnight of Thanksgiving day.
 */
export const thanksgivingUS = cached('tg', (year: number): Date => {
    // Start on the first of November
    const day = new Date(Date.UTC(year, 10, 1));
    // Shift to the 4th Thursday of the month
    day.setUTCDate((11 - day.getUTCDay()) % 7 + 22);
    return day;
});

/**
 * Calculate the day Black Friday falls on in a year.
 *
 * @param year The year.
 * @returns The UTC midnight of Black Friday.
 */
export const blackFriday = cached('bf', (year: number): Date => {
    return plusDays(thanksgivingUS(year), 1);
});

export const emptyDaily = (): DailyMetrics => ({addToCart: 0, purchases: 0, revenue: 0, purchasesPerCountry: {}});
export const emptyMinutely = (): MinutelyMetrics => ({addToCart: 0, purchases: 0, revenue: 0, uniqueUsers: 0});

export const aggregateMinutely = (minutelyMetricsPerRegion: ReadonlyArray<Partial<MinutelyMetrics>>): MinutelyMetrics =>
    minutelyMetricsPerRegion.reduce((acc: MinutelyMetrics, metrics) => {
        acc.addToCart += metrics.addToCart ?? 0;
        acc.purchases += metrics.purchases ?? 0;
        acc.revenue += metrics.revenue ?? 0;
        acc.uniqueUsers += metrics.uniqueUsers ?? 0;
        return acc;
    }, emptyMinutely());

export const aggregateDaily = (dailyMetricsPerRegion: ReadonlyArray<Partial<DailyMetrics>>): DailyMetrics =>
    dailyMetricsPerRegion.reduce((acc: DailyMetrics, metrics) => {
        acc.addToCart += metrics.addToCart ?? 0;
        acc.purchases += metrics.purchases ?? 0;
        acc.revenue += metrics.revenue ?? 0;
        if (metrics.purchasesPerCountry) {
            for (const key of Object.keys(metrics.purchasesPerCountry)) {
                acc.purchasesPerCountry[key] = (acc.purchasesPerCountry[key] ?? 0) + metrics.purchasesPerCountry[key];
            }
        }
        return acc;
    }, emptyDaily());
