import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { cloudflareRateLimiter } from "@hono-rate-limiter/cloudflare";
import { Constants } from "./config.ts"

const app = new Hono()

let JSONHeader = new Headers({"Content-Type": "application/json"})

let db
let archive
let flags

// CORS for Teams (Public) Endpoints
app.use(
  '/teams/*',
  cors({
    origin: (origin, c) => {return origin},
    allowMethods: ['GET'],
  })
)

// CORS for Internal Endpoints
app.use('/internal/*', async (c, next) => {
  const corsMiddlewareHandler = cors({
    origin: (origin, c) => {
      return origin.endsWith('.ftcopenalliance.org') || origin.endsWith('.ftcopenalliance.pages.dev')
        ? origin
        : c.env.CORS_ORIGIN
    },
    allowMethods: ['GET', 'POST'],
    exposeHeaders: ['Content-Length', 'Access-Control-Allow-Origin'],
  })
  return corsMiddlewareHandler(c, next)
})

// API Kill Switch
app.use('/*', async (c, next) => {

    if (c.req.method == "GET") {
        let readEnabled = await flags.get('APIReadEnabled')
        if (readEnabled != 'TRUE' && !Constants.nonBlockedGetRequests.includes(c.req.path)) {
            return new Response("Requests to the FTC Open Alliance are temporarily disabled. If you believe this is a mistake, please contact us.", {status: 503})
        }
    }

    if (c.req.method == "POST") {
        let writeEnabled = await flags.get('APIWriteEnabled')
        if (writeEnabled != 'TRUE' && !Constants.nonBlockedPostRequests.includes(c.req.path)) {
            return new Response("Data Submissions to the FTC Open Alliance are temporarily disabled.", {status: 503})
        }
    }

    await next()

})

// Rate Limiting

// function generateKey(c) {
//     return c.req.header("cf-connecting-ip") ?? ""
// }

// app.use(Constants.baseRateLimitPaths, 
//     cloudflareRateLimiter({
//         message: Constants.rateLimitMessage,
//         rateLimitBinding: (c) => c.env.RATE_LIMIT_BASE,
//         keyGenerator: (c) => generateKey(c),
//   })
// )

// app.use(Constants.moderateRateLimitPaths, 
//     cloudflareRateLimiter({
//         message: Constants.rateLimitMessage,
//         rateLimitBinding: (c) => c.env.RATE_LIMIT_MODERATE,
//         keyGenerator: (c) => generateKey(c),
//   })
// )

// app.use(Constants.strictRateLimitPaths, 
//     cloudflareRateLimiter({
//         message: Constants.rateLimitMessage,
//         rateLimitBinding: (c) => c.env.RATE_LIMIT_STRICT,
//         keyGenerator: (c) => generateKey(c),
//   })
// )

// Caching
app.use("/*", async (c, next) => {
    
    let req = c.req.raw
    let cache = caches.default

    if (req.method != 'GET') {
        await next()
        return
    }

    let cachedResponse = await cache.match(req)
    if (cachedResponse != undefined) {
        return cachedResponse
    }

    await next()
    
    let res = c.res.clone()

    let cacheTime = 0

    Object.keys(Constants.cacheTimes).forEach((key) => {
        let pattern = new URLPattern({pathname: key})
        if (pattern.test(req.url)) {
            cacheTime = res.ok ? Constants.cacheTimes[key][0] : Constants.cacheTimes[key][1]
        }
    })

    if (cacheTime > 0) { console.info(`Request reached DB: ${c.req.path} | Now Caching for ${cacheTime} seconds.`) }

    res.headers.set("Cache-Control", `max-age=${cacheTime}`)

    await cache.put(req, res)
})

app.get('/', async (c) => {
    return new Response(`
      <h1>Hello, World!</h1>
      <p>You've successfully accessed the FTC Open Alliance API.</p>`,
        {headers: new Headers({"Content-Type": "text/html"})})
    })
    
app.get('/teams', async (c) => {
    
    let data = await db.prepare(`
        SELECT Teams.*, TeamLinks.*, NAward.NewestAwardYear, NAward.NewestAward FROM Teams
        LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber
        LEFT JOIN (SELECT TeamAwards.TeamNumber, MAX(TeamAwards.Year) AS NewestAwardYear, TeamAwards.Award AS NewestAward FROM TeamAwards GROUP BY TeamAwards.TeamNumber) AS NAward ON Teams.TeamNumber = NAward.TeamNumber
        `).run()
    
    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
})
    
app.get('/teams/:teamnumber', async (c) => {
    
    let data = await db.prepare("SELECT * FROM Teams LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber WHERE Teams.TeamNumber IS ?")
    .bind(c.req.param('teamnumber'))
    .run()
    
    if (data.results == '') {return new Response('Team does not exist.', {status: 400})}
    
    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
    
})

// /teams/:teamnumber/all and /internal/formAutofillData/:teamnumber both have the same query, but the former is cached.
async function allTeamDataHandler(c) {

    let returnData = {}

    if (isNaN(c.req.param('teamnumber'))) {return new Response('Team Number Invalid.', {status: 400})}
    
    let data = await db.prepare(`
        SELECT Teams.*, TeamLinks.*, TeamInfo.*, RobotInfo.*, CodeInfo.*, FreeResponse.* FROM Teams
        LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber
        LEFT JOIN TeamInfo ON Teams.TeamNumber = TeamInfo.TeamNumber
        LEFT JOIN RobotInfo ON Teams.TeamNumber = RobotInfo.TeamNumber
        LEFT JOIN CodeInfo ON Teams.TeamNumber = CodeInfo.TeamNumber
        LEFT JOIN FreeResponse ON Teams.TeamNumber = FreeResponse.TeamNumber
        WHERE Teams.TeamNumber IS ?
        `)
    .bind(c.req.param('teamnumber'))
    .run()

    let awardData = await db.prepare("SELECT TeamAwards.Award, TeamAwards.Year FROM TeamAwards WHERE TeamNumber IS ?")
    .bind(c.req.param('teamnumber'))
    .run()
    
    if (data.results == '') {return new Response('Team does not exist.', {status: 400})}

    returnData = data.results[0]

    //Parse Array Data
    for (const key in data.results[0]) {
        if (Constants.arrayData.includes(key)) {
            returnData[key] = JSON.parse(returnData[key])
        }
    }

    returnData.Awards = awardData.results.sort((a, b) => a.Year - b.Year) || []

    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
    
}

app.get('/teams/:teamnumber/all', allTeamDataHandler)
app.get('/internal/formAutofillData/:teamnumber', allTeamDataHandler)

app.get('/internal/checkTeamPII/:teamnumber', async (c) => {
    let data = await db.prepare("SELECT EXISTS(SELECT * FROM TeamPII WHERE TeamNumber IS ?)")
    .bind(c.req.param('teamnumber'))
    .run()

    let exists = Object.values(data.results[0])[0] == 1
    
    return new Response(`{"PIIExists": ${exists}}`, {headers: JSONHeader})
})

app.get('/internal/getArchiveList', async (c) => {

    let data = await archive.list()

    let returnData = []

    try {
        data.objects.forEach(object => {
            returnData.push({
                Name: object.key,
                Tag: object.httpEtag,
                Size: object.size,
                SizeKB: (object.size / 1000),
                Timestamp: object.uploaded
            })
        });
    } catch (error) {
        return new Response(`Failed to fetch archive list.`, {status: 400})
    }

    return new Response(JSON.stringify(returnData), {headers: JSONHeader})

})

app.get('/internal/getTeamStats', async (c) => {

    let uncountedData = {}

    let returnData = {}

    let numTeams = 0

    //Loop through the tables specified in the JSON Object
    for (const table of Object.keys(Constants.statsSchema)) { 

        //Get the list of columns for the current table
        let columnNames = Constants.statsSchema[table]

        //Make a new empty array for each column in both objects.
        columnNames.forEach((column) => {
            uncountedData[column] = []
            returnData[column] = []
        })

        //DB Query
        let dbData = await db.prepare(`SELECT ${columnNames.join(', ')} FROM ${table}`).run()

        numTeams = dbData.results.length

        //For every column of every entry, check if it is an array.
        //If it is, add every element to the respective array.
        //Otherwise, simply add the value to the array directly.
        dbData.results.forEach((entry) => {
            columnNames.forEach((column) => {
                try {
                    if (Array.isArray(JSON.parse(entry[column]))) {
                        JSON.parse(entry[column]).forEach((option) => {
                            uncountedData[column].push(option)
                        })
                    }
                } catch (error) {
                    uncountedData[column].push(entry[column])
                }
            })
        })
    }

    //Loop over every statistic
    Object.keys(uncountedData).forEach((stat) => {

        //For every unique statistic, add an object to the results array that contains it's name and count.
        //(Formatted for Apache ECharts)
        ([...new Set(uncountedData[stat])]).forEach((uniqueAnswer) => {
            returnData[stat].push(
                {
                    name: uniqueAnswer,
                    value: uncountedData[stat].filter(x => x === uniqueAnswer).length
                }
                    
            )
        })

    })

    returnData.NumTeams = numTeams

    return new Response(JSON.stringify(returnData), {headers: JSONHeader})

})

app.get('/internal/getWebFlags', async (c) => {
    let data = {}
    for (const key of Constants.publicWebFlags) {
        let value = await flags.get(key)
        data[key] = value
    }
    return new Response(JSON.stringify(data), {headers: JSONHeader})
})

app.post('/internal/formSubmission', async (c) => {
    
    let formData
    let teamLocation

    try {
        formData = await c.req.json()
    } catch (e) {
        return new Response('Input is Invalid JSON.', {status: 400})
    }
    
    if (isNaN(formData.TeamNumber)) {return new Response('Team Number Invalid.', {status: 400})}

    //Serialize Arrays
    for (const key in formData) {
        if (!Constants.arrayData.includes(key)) {continue}
        if (!Array.isArray(formData[key])) {return new Response(`Field ${key} is not an array.`, {status: 400})}
        try {
            formData[key] = JSON.stringify(formData[key])
        } catch (e) {
            return new Response(`Serialization failed for field ${key}`, {status: 400})
        }
    }

    try {
        
        let scoutData = await fetch(`https://api.ftcscout.org/rest/v1/teams/${formData.TeamNumber}`)
        let teamData = await scoutData.json()

        teamLocation = [teamData.city, teamData.state, teamData.country].join(", ")

    } catch (error) {
        teamLocation = null
    }

    try {
        //Team Identification
        await db.prepare("INSERT OR REPLACE INTO Teams (TeamName, TeamNumber, Location) VALUES (?, ?, ?)")
        .bind(formData.TeamName, formData.TeamNumber, teamLocation || null)
        .run()

        await db.prepare("INSERT OR IGNORE INTO TeamPII (TeamNumber, ContactEmail, ShipAddress) VALUES (?, ?, ?)")
        .bind(formData.TeamNumber, (formData.ContactEmail || null), (formData.ShipAddress || null))
        .run()
        
        //Team Links
        await db.prepare("INSERT OR REPLACE INTO TeamLinks (TeamNumber, BuildThread, CAD, Code, Photo, Video, TeamWebsite) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(formData.TeamNumber, (formData.BuildThread || null), (formData.CAD || null), (formData.Code || null), (formData.Photo || null), (formData.Video || null), (formData.TeamWebsite || null))
        .run()

        //Team Info
        await db.prepare("INSERT OR REPLACE INTO TeamInfo (TeamNumber, RookieYear, TeamMembers, Mentors, TeamType, MeetingHours, Budget, Workspace, Sponsors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(formData.TeamNumber, (formData.RookieYear || null), (formData.TeamMembers || null), (formData.Mentors || null), (formData.TeamType || null), (formData.MeetingHours || null), (formData.Budget || null), (formData.Workspace || null), (formData.Sponsors || null))
        .run()

        //Robot Info
        await db.prepare("INSERT OR REPLACE INTO RobotInfo (TeamNumber, Drivetrain, Materials, Products, Systems, Odometry, Sensors) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(formData.TeamNumber, (formData.Drivetrain || null), (formData.Materials || null), (formData.Products || null), (formData.Systems || null), (formData.Odometry || null), (formData.Sensors || null))
        .run()

        //Code Info
        await db.prepare("INSERT OR REPLACE INTO CodeInfo (TeamNumber, CodeLang, CodeEnv, CodeTools, Vision) VALUES (?, ?, ?, ?, ?)")
        .bind(formData.TeamNumber, (formData.CodeLang || null), (formData.CodeEnv || null), (formData.CodeTools || null), (formData.Vision || null))
        .run()

        //Free Response
        await db.prepare("INSERT OR REPLACE INTO FreeResponse (TeamNumber, UniqueFeatures, Outreach, CodeAdvantage, Competitions, TeamStrategy, GameStrategy, DesignProcess) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(formData.TeamNumber, (formData.UniqueFeatures || null), (formData.Outreach || null), (formData.CodeAdvantage || null), (formData.Competitions || null), (formData.TeamStrategy || null), (formData.GameStrategy || null), (formData.DesignProcess || null))
        .run()

        return new Response(`Updated Data for team ${formData.TeamNumber}`, {status: 200})
        
    } catch (e) {
        console.log(e)
        return new Response('D1 SQL Error.', {status: 500})
    }
    
})

export default {
    async fetch(request, env, ctx) {
        db = env.FTCOA_MAIN_DB
        archive = env.FTCOA_ARCHIVE
        flags = env.WEB_FLAGS
        return app.fetch(request, env, ctx)
    }
}