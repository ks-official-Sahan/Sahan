import { BookCopy, Hash } from "lucide-react";

export const UpdatesContent = {
    title: {
        w1: "Recent",
        w2: "Updates"
    },
    subtitle: "Stay Updated with My Latest Work & Moments",
    fs: {
        topics: {
            title: "Topics",
            icon: BookCopy
        },
        tags: {
            title: "Tags",
            icon: Hash
        }
    },
    topics: [
        {
            id: 1,
            name: "Releases",
            updates: 2
        },
        {
            id: 2,
            name: "Personal",
            updates: 1
        },
        {
            id: 3,
            name: "Bug Fix",
            updates: 0
        },
        {
            id: 4,
            name: "New Features",
            updates: 1
        },
        {
            id: 5,
            name: "Other",
            updates: 0
        }
    ],
    tags: ["Next.js", "React", "SEO", "Accessibility", "Portfolio"],
    posts: [
        {
            id: "1",
            title: "Upgraded the portfolio to Next.js 16 and React 19",
            date: "September 2026",
            content: "Migrated the whole site to Next.js 16 and React 19, fixed a number of bugs surfaced along the way (a broken hydration mismatch, an invalid nested-button pattern, dead code from an abandoned blog feature), and cleaned up the theming setup so the dark/light toggle has a single source of truth.",
            topic: "Releases",
            tags: ["Next.js", "React", "Portfolio"]
        },
        {
            id: "2",
            title: "Added real projects, work history, and live GitHub stats",
            date: "September 2026",
            content: "Replaced the empty Works page with real project case studies (the Datalake Creative product line, freelance client sites, and past contract work), added a proper work experience timeline, and wired up a live GitHub activity card on the About page.",
            topic: "New Features",
            tags: ["Portfolio"]
        },
        {
            id: "3",
            title: "SEO, accessibility, and performance overhaul",
            date: "September 2026",
            content: "Fixed the site's metadata (proper Open Graph/Twitter tags, a generated social preview image, sitemap, robots.txt, and structured data), resolved every accessibility issue an automated WCAG audit could find, and trimmed unused fonts and dependencies.",
            topic: "Releases",
            tags: ["SEO", "Accessibility", "Portfolio"]
        },
        {
            id: "4",
            title: "Joined Datalake Creative Ltd",
            date: "2025",
            content: "Started as a Full-Stack Software Engineer at Datalake Creative Ltd (UK), working across a portfolio of cross-platform products spanning Android, iOS, web, and admin dashboards.",
            topic: "Personal",
            tags: []
        }
    ]
}
