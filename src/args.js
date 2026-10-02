export function parseCommand(argv) {
  const args = argv.slice(2);
  if (args[0] === "service" || args[0] === "product") {
    return { line: args[0], lead: args.slice(1).join(" ").trim() };
  }
  return { line: "service", lead: args.join(" ").trim() };
}
