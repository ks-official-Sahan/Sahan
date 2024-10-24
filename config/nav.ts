const routes = {
  HOME: { path: "/", title: "Home" },
  ABOUT: { path: "/about", title: "About" },
  WOKRS: { title: "Works", path: "/works" },
  UPDATES: { title: "Updates", path: "/updates" },
  CONTACT: { title: "Contact", path: "/contact" },
  // BLOG: { title: "Blog", path: "/blog" },
};

const navbarItems = [routes.HOME, routes.ABOUT, routes.WOKRS, routes.UPDATES];

const sidebarItems = [...navbarItems, routes.CONTACT];

export const SiteNavigations = {
  navbar: navbarItems,
  sidebar: sidebarItems,
};
