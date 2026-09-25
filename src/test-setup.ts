/**
 * Pin the test timezone.
 *
 * Every date helper works in the browser's local time, and this app is used
 * from Melbourne. Running the suite in UTC (the CI default) shifts "today" by
 * a day and makes the expectations below look wrong when the code is right.
 * Pinning it here also means the daylight-saving test is actually exercising
 * a DST transition rather than a timezone that has none.
 */
process.env.TZ = 'Australia/Melbourne'
