// Where announcements come from. The web app reads its own copy.
// build.sh rewrites this for the Chrome extension when NEWS_URL is set,
// pointing it at the hosted file so posts show up without a new release.
const AgendaConfig = {
  newsUrl: "data/announcements.json"
};
