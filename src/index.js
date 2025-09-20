import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { cors } from 'hono/cors'

const app = new Hono()

let JSONHeader = new Headers({"Content-Type": "application/json"})

let db

let archive

const arrayData = ['Materials', 'Products', 'Systems', 'Odometry', 'Sensors', 'CodeTools', 'Vision']

const statsSchema = {
    TeamInfo: ['TeamType', 'Budget', 'Workspace', 'Sponsors'],
    RobotInfo: ['Drivetrain', 'Materials', 'Products', 'Systems', 'Sensors', 'Odometry'],
    CodeInfo: ['CodeLang', 'CodeEnv', 'CodeTools', 'Vision']
}

app.use(
  '/teams/*',
  cors({
    origin: (origin, c) => {return origin},
    allowMethods: ['GET'],
  })
)

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

app.get('/', async (c) => {
    return new Response(`
      <h1>Hello, World!</h1>
      <p>You've successfully accessed the FTC Open Alliance API.</p>`,
        {headers: new Headers({"Content-Type": "text/html"})})
    })
    
app.get('/teams', async () => {
    
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

app.get('/teams/:teamnumber/allAwards', async (c) => {
    
    let data = await db.prepare("SELECT TeamAwards.Award, TeamAwards.Year FROM TeamAwards WHERE TeamNumber IS ?")
    .bind(c.req.param('teamnumber'))
    .run()
    
    if (data.results == '') {return new Response('Team does not exist.', {status: 400})}
    
    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
    
})

app.get('/teams/:teamnumber/all', async (c) => {

    if (isNaN(c.req.param('teamnumber'))) {return new Response('Team Number Invalid.', {status: 400})}
    
    let data = await db.prepare(`
        SELECT Teams.*, TeamLinks.*, TeamInfo.*, RobotInfo.*, CodeInfo.*, FreeResponse.*, NAward.NewestAwardYear, NAward.NewestAward FROM Teams
        LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber
        LEFT JOIN TeamInfo ON Teams.TeamNumber = TeamInfo.TeamNumber
        LEFT JOIN RobotInfo ON Teams.TeamNumber = RobotInfo.TeamNumber
        LEFT JOIN CodeInfo ON Teams.TeamNumber = CodeInfo.TeamNumber
        LEFT JOIN FreeResponse ON Teams.TeamNumber = FreeResponse.TeamNumber
        LEFT JOIN (SELECT TeamAwards.TeamNumber, MAX(TeamAwards.Year) AS NewestAwardYear, TeamAwards.Award AS NewestAward FROM TeamAwards GROUP BY TeamAwards.TeamNumber) AS NAward ON Teams.TeamNumber = NAward.TeamNumber
        WHERE Teams.TeamNumber IS ?
        `)
    .bind(c.req.param('teamnumber'))
    .run()
    
    if (data.results == '') {return new Response('Team does not exist.', {status: 400})}

    //Parse Array Data
    for (const key in data.results[0]) {
        if (arrayData.includes(key)) {
            data.results[0][key] = JSON.parse(data.results[0][key])
        }
    }

    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
    
})

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
    for (const table of Object.keys(statsSchema)) { 

        //Get the list of columns for the current table
        let columnNames = statsSchema[table]

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
        if (!arrayData.includes(key)) {continue}
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
        return app.fetch(request, env, ctx)
    }
}