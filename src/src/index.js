
var src_default = {
  async fetch(request, env) {
    const db = env.ftcoatestdb;

    const queryString = new URL(request.url).pathname

    let isQueryStringValid = false

    let responseString = "Error 404: The resource specified cannot be found."

    if (queryString == "/teamsSimple") {

      isQueryStringValid = true

      const res = await db.prepare(
        "SELECT * FROM Teams"
      ).run()

      responseString = JSON.stringify(res.results)

    }

    if (queryString == "/teamLinks") {

      isQueryStringValid = true

      const res = await db.prepare(
        "SELECT * FROM TEAMLINKS"
      ).run()

      responseString = JSON.stringify(res.results)

    }

    return new Response(responseString, {
      headers: {
        "content-type": isQueryStringValid ? "application/json" : "text/html"
      },
      status: isQueryStringValid ? 200 : 404
    });
  }
};
export {
  src_default as default
};
