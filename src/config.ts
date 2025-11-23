export abstract class Constants {

    public static arrayData = ['Materials', 'Products', 'Systems', 'Odometry', 'Sensors', 'CodeTools', 'Vision']

    public static statsSchema = {
        TeamInfo: ['TeamType', 'Budget', 'Workspace', 'Sponsors'],
        RobotInfo: ['Drivetrain', 'Materials', 'Products', 'Systems', 'Sensors', 'Odometry'],
        CodeInfo: ['CodeLang', 'CodeEnv', 'CodeTools', 'Vision']
    }

    public static nonBlockedGetRequests = ["/internal/getWebFlags", "/"]

    public static nonBlockedPostRequests = ["/"]

    public static cacheTimes = {
        "/teams/*?": [1200, 120], //20 mins if OK, 2 mins otherwise.
        "/internal/getTeamStats": [3600, 120] // 1 hr if OK, 2 mins otherwise.
    }
    public static baseRateLimitPaths = ["/teams", "/teams/*", "/internal/checkTeamPII", "/internal/getWebFlags"]
    public static moderateRateLimitPaths = ["/internal/getTeamStats", "/internal/getArchiveList"]
    public static strictRateLimitPaths = ["/internal/formSubmission"]

    public static rateLimitMessage = "You have sent too many requests. Please try again later."

    public static publicWebFlags = [
        "BannerHTML"
    ]

}