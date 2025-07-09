
var src_default = {
  async fetch(request, env) {
    const { ftcoatestdb } = env;

    const res = await ftcoatestdb.prepare(
      "SELECT * FROM Teams"
    ).run()

    console.log((res.results))

    return new Response(JSON.stringify(res.results), {
      headers: {
        "content-type": "application/json; charset=UTF-8"
      }
    });
  }
};
export {
  src_default as default
};
