/// <reference path="../node_modules/@astrojs/starlight/dist/global.d.ts" />
// Gives the splash home pages a sidebar, so the mobile header has its menu button there too.
// Starlight renders the menu button only inside the sidebar, and gives a splash page none;
// site.css hides that sidebar again on wide screens, where the home page keeps its full width.
import { defineRouteMiddleware } from "@astrojs/starlight/route-data";

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  if (route.entry.data.template === "splash") route.hasSidebar = true;
});
