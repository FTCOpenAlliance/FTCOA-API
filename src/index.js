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
    
    let data = await db.prepare("SELECT * FROM Teams").run()
    
    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
})

app.get('/teams/:teamnumber', async (c) => {
    
    let data = await db.prepare("SELECT * FROM Teams WHERE TeamNumber IS ?")
    .bind(c.req.param('teamnumber'))
    .run()
    
    if (data.results == '') {return new Response('Team does not exist.', {status: 400})}
    
    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
    
})

app.get('/teams/:teamnumber/links', async (c) => {
    
    let data = await db.prepare("SELECT * FROM TeamLinks WHERE TeamNumber IS ?")
    .bind(c.req.param('teamnumber'))
    .run()
    
    if (data.results == '') {return new Response('Team does not exist.', {status: 400})}
    
    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
    
})

app.get('/internal/teamListData', async () => {
    
    let data = await db.prepare("SELECT * FROM Teams LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber").run()
    
    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
})

app.post('/internal/formSubmission', async (c) => {
    
    let formData = await c.req.json()
    
    if (isNaN(formData.teamNumber)) {return new Response('Team Number Invalid.', {status: 400})}
    try {
        //Team Info
        await db.prepare("INSERT OR REPLACE INTO Teams (TeamName, TeamNumber) VALUES (?, ?)")
        .bind(formData.teamName, formData.teamNumber)
        .run()
        
        //Team Links
        await db.prepare("INSERT OR REPLACE INTO TeamLinks (TeamNumber, BuildThread, CAD, Code, Photo, Video, TeamWebsite) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(formData.teamNumber, (formData.buildThread || null), (formData.cadLink || null), (formData.codeLink || null), (formData.photoLink || null), (formData.videoLink || null), (formData.teamWebsite || null))
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