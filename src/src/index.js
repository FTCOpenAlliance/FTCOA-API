import { Router } from '@tsndr/cloudflare-worker-router'

const router = new Router()

let JSONHeader = new Headers({"Content-Type": "application/json"})

let db

router.debug()

router.cors()

router.get('/', async () => {
    return new Response(`
      <h1>Hello, World!</h1>
      <p>You've successfully accessed the FTC Open Alliance API.</p>`,
      {headers: new Headers({"Content-Type": "text/html"})})
})

router.get('/teams', async () => {

    let data = await db.prepare("SELECT * FROM Teams").run()

    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
})

router.get('/teams/:teamnumber', async ({ req }) => {

    let data = await db.prepare("SELECT * FROM Teams WHERE TeamNumber IS " + req.params.teamnumber).run()

    if (data.results == '') {return new Response('Team does not exist.', {status: 400})}

    return new Response(JSON.stringify(data.results), {headers: JSONHeader})

})

router.get('/teams/:teamnumber/links', async ({ req }) => {

    let data = await db.prepare("SELECT * FROM TeamLinks WHERE TeamNumber IS " + req.params.teamnumber).run()

    if (data.results == '') {return new Response('Team does not exist.', {status: 400})}

    return new Response(JSON.stringify(data.results), {headers: JSONHeader})

})

router.get('/internal/teamListData', async () => {

    let data = await db.prepare("SELECT * FROM Teams LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber").run()

    return new Response(JSON.stringify(data.results), {headers: JSONHeader})
})

export default {
    async fetch(request, env, ctx) {

        db = env.ftcoatestdb
        return router.handle(request, env, ctx)
    }
}