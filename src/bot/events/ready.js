export default async function ready(client) {
  console.log(`[bot] Logged in as ${client.user.tag} (${client.guilds.cache.size} servers)`);
}
