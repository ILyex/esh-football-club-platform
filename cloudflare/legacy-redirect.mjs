const TARGET_HOST = "esh.football-club-platform.workers.dev";

export default {
  fetch(request) {
    const target = new URL(request.url);
    target.hostname = TARGET_HOST;
    return Response.redirect(target.toString(), 308);
  }
};
