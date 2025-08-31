import { Hono } from 'hono'

const app = new Hono()

let JSONHeader = new Headers({"Content-Type": "application/json"})

let db

app.get('/', async () => {
    return new Response(`
      <h1>Hello, World!</h1>
      <p>You've successfully accessed the FTC Open Alliance API.</p>`,
        {headers: new Headers({"Content-Type": "text/html"})})
    })
    
app.get('/teams', async () => {
    
    let data = await db.prepare("SELECT * FROM Teams LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber").run()
    
    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
})
    
app.get('/teams/:teamnumber', async (c) => {
    
    let data = await db.prepare("SELECT * FROM Teams WHERE TeamNumber IS ? LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber")
    .bind(c.req.param('teamnumber'))
    .run()
    
    if (data.results == '') {return new Response('Team does not exist.', {status: 400})}
    
    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
    
})

app.get('/teams/:teamnumber/all', async (c) => {

    if (isNaN(formData.teamNumber)) {return new Response('Team Number Invalid.', {status: 400})}
    
    let data = await db.prepare(`
        SELECT * FROM Teams WHERE TeamNumber IS ?
        LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber
        LEFT JOIN TeamInfo ON Teams.TeamNumber = TeamInfo.TeamNumber
        LEFT JOIN RobotInfo ON Teams.TeamNumber = RobotInfo.TeamNumber
        LEFT JOIN CodeInfo ON Teams.TeamNumber = CodeInfo.TeamNumber
        LEFT JOIN FreeResponse ON Teams.TeamNumber = FreeResponse.TeamNumber
        `)
    .bind(c.req.param('teamnumber'))
    .run()
    
    if (data.results == '') {return new Response('Team does not exist.', {status: 400})}
    
    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
    
})

app.post('/internal/formSubmission', async (c) => {
    
    let formData = await c.req.json()
    
    if (isNaN(formData.teamNumber)) {return new Response('Team Number Invalid.', {status: 400})}

    try {
        //Team Identification
        await db.prepare("INSERT OR REPLACE INTO Teams (TeamName, TeamNumber) VALUES (?, ?)")
        .bind(formData.teamName, formData.teamNumber)
        .run()
        
        //Team Links
        await db.prepare("INSERT OR REPLACE INTO TeamLinks (TeamNumber, BuildThread, CAD, Code, Photo, Video, TeamWebsite) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(formData.teamNumber, (formData.buildThread || null), (formData.cadLink || null), (formData.codeLink || null), (formData.photoLink || null), (formData.videoLink || null), (formData.teamWebsite || null))
        .run()

        //Team Info
        await db.prepare("INSERT OR REPLACE INTO TeamInfo (TeamNumber, RookieYear, TeamMembers, Mentors, TeamType, MeetingHours, Budget, Workspace, Sponsors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(formData.teamNumber, (formData.rookieYear || null), (formData.teamMembers || null), (formData.mentors || null), (formData.teamType || null), (formData.meetingHours || null), (formData.budget || null), (formData.workspace || null), (formData.sponsors || null))
        .run()

        //Robot Info
        await db.prepare("INSERT OR REPLACE INTO RobotInfo (TeamNumber, Drivetrain, Materials, Products, Systems, Odometry, Sensors) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(formData.teamNumber, (formData.drivetrain || null), (formData.materials || null), (formData.products || null), (formData.systems || null), (formData.odometry || null), (formData.sensors || null))
        .run()

        //Code Info
        await db.prepare("INSERT OR REPLACE INTO CodeInfo (TeamNumber, CodeLang, CodeEnv, CodeTools, Vision) VALUES (?, ?, ?, ?, ?)")
        .bind(formData.teamNumber, (formData.codeLang || null), (formData.codeEnv || null), (formData.codeTools || null), (formData.vision || null))
        .run()

        //Free Response
        await db.prepare("INSERT OR REPLACE INTO FreeResponse (TeamNumber, UniqueFeatures, Outreach, CodeAdvantage, Competitions, TeamStrategy, GameStrategy, DesignProcess) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(formData.teamNumber, (formData.uniqueFeatures || null), (formData.outreach || null), (formData.codeAdvantage || null), (formData.competitions || null), (formData.teamStrategy || null), (formData.gameStrategy || null), (formData.designProcess || null))
        .run()

        return new Response(`Updated Data for team ${formData.teamNumber}`, {status: 200})
        
    } catch (e) {
        console.log(e)
        return new Response('D1 SQL Error.', {status: 500})
    }
    
})

export default {
    async fetch(request, env, ctx) {
        db = env.FTCOA_MAIN_DB
        return app.fetch(request, env, ctx)
    }
}