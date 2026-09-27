# String audit: every user-visible string on the CMS pages

Each row says where a string lives today and how the CMS treats it: a registry field (editable), a derived value (computed from data or config) or code only (accessibility text and the like). It is the checklist behind the section registry in `lib/cms/pages/*`; the registry completeness test enforces the same rule mechanically.

## String audit: Home page (/)

| String | File | Classification | Section.field | Reason |
|--------|------|-----------------|---------------|--------|
| "Open to freelance projects" | contents/home.ts | registry field | hero.status | Status badge |
| "I build web and mobile products from first sketch to production." | contents/home.ts | registry field | hero.title | Page heading |
| "{Site.myRole} at {Site.org}, working remotely from Sri Lanka." | contents/home.ts | registry field | hero.subtitle | Tagline (Site values interpolated at call time) |
| "View my work" | contents/home.ts | registry field | hero.primary.label | CTA button |
| "#works" | contents/home.ts | registry field | hero.primary.href | Link target |
| "Get in touch" | contents/home.ts | registry field | hero.secondary.label | CTA button |
| "/contact" | contents/home.ts | registry field | hero.secondary.href | Link target |
| "I'm a" | contents/home.ts | registry field | iam.prefix | Label for role rotator |
| "Full-stack engineer" | contents/home.ts | registry field | iam.words[0] | Role item |
| "Next.js builder" | contents/home.ts | registry field | iam.words[1] | Role item |
| "Mobile app developer" | contents/home.ts | registry field | iam.words[2] | Role item |
| "Dashboard maker" | contents/home.ts | registry field | iam.words[3] | Role item |
| "API designer" | contents/home.ts | registry field | iam.words[4] | Role item |
| "Remote teammate" | contents/home.ts | registry field | iam.words[5] | Role item |
| "Tap for another" | contents/home.ts | registry field | iam.hint | Interaction hint |
| "Say hello" | contents/home.ts | registry field | channels.title | Contact section label |
| "WhatsApp" | contents/home.ts | registry field | channels.whatsApp.label | Channel name |
| "Chat now" | contents/home.ts | registry field | channels.whatsApp.detail | Channel action |
| "Telegram" | contents/home.ts | registry field | channels.telegram.label | Channel name |
| "Message me" | contents/home.ts | registry field | channels.telegram.detail | Channel action |
| "Email" | contents/home.ts | registry field | channels.email.label | Channel name |
| "{Site.email}" | contents/home.ts | registry field | channels.email.detail | Channel contact |
| "(opens in a new tab)" | contents/home.ts | registry field | channels.newTab | Screen reader label |
| "Track record" | contents/home.ts | registry field | proof.label | Section label |
| "Projects shipped" | contents/home.ts | derived | proof | Stat label (Projects.length) |
| "Client websites" | contents/home.ts | derived | proof | Stat label (filtered Projects) |
| "Platforms covered" | contents/home.ts | derived | proof | Stat label (unique platforms) |
| "Technologies used" | contents/home.ts | derived | proof | Stat label (unique skills) |
| "Built with teams and for clients" | contents/home.ts | registry field | teams.label | Section label |
| "Why people hire me" | contents/home.ts | registry field | why.title | Section heading |
| "What you get when one engineer owns the whole product." | contents/home.ts | registry field | why.subtitle | Section description |
| "One engineer, the whole product" | contents/home.ts | registry field | why.points[0].title | Benefit title |
| "Interface, API, database and deployment from one person, so nothing gets lost between handoffs." | contents/home.ts | registry field | why.points[0].body | Benefit description |
| "Shipped on every platform" | contents/home.ts | registry field | why.points[1].title | Benefit title |
| "Android, iOS, web and admin panels. The work on this page is proof, not a promise." | contents/home.ts | registry field | why.points[1].body | Benefit description |
| "Built to keep running" | contents/home.ts | registry field | why.points[2].title | Benefit title |
| "Backups with fallbacks, versioned content snapshots, caching and multi-factor sign-in: the unglamorous parts that keep a product alive." | contents/home.ts | registry field | why.points[2].body | Benefit description |
| "Easy to work with from anywhere" | contents/home.ts | registry field | why.points[3].title | Benefit title |
| "Remote by default, currently with a UK-based team. Clear updates and working builds along the way." | contents/home.ts | registry field | why.points[3].body | Benefit description |
| "Selected work" | contents/home.ts | registry field | home.works.title | Section heading |
| "Products and client sites I have built and shipped. Open any of them to see the details." | contents/home.ts | registry field | home.works.subtitle | Section description |
| "What I can build for you" | contents/home.ts | registry field | home.services.title | Section heading |
| "Web, mobile and backend work, handled from design to deployment." | contents/home.ts | registry field | home.services.subtitle | Section description |
| "How a project runs" | contents/home.ts | registry field | home.process.title | Section heading |
| "Four steps, and you know where things stand at each one." | contents/home.ts | registry field | home.process.subtitle | Section description |
| "Tools I work with every day" | contents/home.ts | registry field | home.toolbox.title | Section heading |
| "The stack behind the products above." | contents/home.ts | registry field | home.toolbox.subtitle | Section description |
| "Questions, answered" | contents/home.ts | registry field | home.faq.title[0] | Section heading part 1 |
| "Frequently" | contents/home.ts | registry field | home.faq.title[0] | Section heading part 2 |
| "Asked" | contents/home.ts | registry field | home.faq.title[1] | Section heading part 3 |
| "Questions" | contents/home.ts | registry field | home.faq.title[2] | Section heading |
| "The things people usually ask before we start." | contents/home.ts | registry field | home.faq.subtitle | Section description |
| "Talk it through" | contents/home.ts | registry field | process[0].title | Process step 1 |
| "Send a short description of what you want to build. I reply with questions and a rough scope." | contents/home.ts | registry field | process[0].body | Process step 1 detail |
| "Agree the plan" | contents/home.ts | registry field | process[1].title | Process step 2 |
| "We settle scope, screens and stack before any code is written, so there are no surprises later." | contents/home.ts | registry field | process[1].body | Process step 2 detail |
| "Build in the open" | contents/home.ts | registry field | process[2].title | Process step 3 |
| "You see working builds early and often, not one big reveal at the end." | contents/home.ts | registry field | process[2].body | Process step 3 detail |
| "Ship and support" | contents/home.ts | registry field | process[3].title | Process step 4 |
| "I deploy it, hand over the code, and stay available for fixes and next steps." | contents/home.ts | registry field | process[3].body | Process step 4 detail |
| "Have something you need built?" | contents/home.ts | registry field | finalCta.title | CTA heading |
| "Tell me what you are working on. We can talk through scope, timing and the best way to build it." | contents/home.ts | registry field | finalCta.subtitle | CTA description |
| "Start a project" | contents/home.ts | registry field | finalCta.primary.label | CTA button |
| "/contact" | contents/home.ts | registry field | finalCta.primary.href | CTA link target |
| "Copy email" | contents/home.ts | registry field | finalCta.copyLabel | Copy button label |
| "Email copied" | contents/home.ts | registry field | finalCta.copiedLabel | Copy confirmation |
| "Still have questions?" | components/home/FAQSection.tsx | code-only | faqSidebar.heading | Sidebar heading (FAQ section) |
| "Send me a message and we can talk it through." | components/home/FAQSection.tsx | code-only | faqSidebar.text | Sidebar text (FAQ section) |
| "Contact me" | components/home/FAQSection.tsx | code-only | faqSidebar.button | Sidebar button (FAQ section) |
| "Know someone hiring? Share my portfolio" | components/home/FinalCta.tsx | code-only | shareSite.label | Share button label |
| "Link copied" | components/home/FinalCta.tsx | code-only | shareSite.copied | Share confirmation |
| "Portfolio link copied" | components/home/FinalCta.tsx | code-only | shareSite.sr | Screen reader announcement |
| "Portrait of {Site.authorFullName}" | components/home/HomeHero.tsx | derived | heroImage.alt | Image alt text |
| "Track record" | components/home/ProofStrip.tsx | derived | proofSection.label | ARIA label (from proof.label via HomeContent) |
| "Featured projects" | components/home/FeaturedWorksSection.tsx | code-only | featuredWorks.label | SnapRow label (decoration) |
| "Services" | components/home/ServiceOverviewSection.tsx | code-only | services.label | SnapRow label (decoration) |
| "{category.category}" | components/home/ToolboxSection.tsx | derived | toolbox.categories | Category names from MySkills |
| "{category.category} skills" | components/home/ToolboxSection.tsx | derived | toolbox.categoryLabel | Marquee ARIA label |
| "{question}" | contents/home.ts (faq.questions) | registry field | faq.questions[*].question | FAQ question text |
| "{answer.intro}" | contents/home.ts (faq.questions) | registry field | faq.questions[*].answer.intro | FAQ answer intro |
| "{answer.points[*]}" | contents/home.ts (faq.questions) | registry field | faq.questions[*].answer.points[*] | FAQ answer bullet point |
| "{answer.outro}" | contents/home.ts (faq.questions) | registry field | faq.questions[*].answer.outro | FAQ answer outro |
| "layers" | contents/home.ts | registry field | why.points[0].icon | Icon key (why points) |
| "smartphone" | contents/home.ts | registry field | why.points[1].icon | Icon key (why points) |
| "shield" | contents/home.ts | registry field | why.points[2].icon | Icon key (why points) |
| "globe" | contents/home.ts | registry field | why.points[3].icon | Icon key (why points) |

## Notes

- **Site values**: herosubtitle and channels.email.detail interpolate `Site` values at render time; these are not editable through the CMS in step 9.
- **Derived values**: stat labels, category names, and image alt text are computed from collections (Projects, MySkills, Site) and remain derived. They do not belong in the registry.
- **Code-only strings**: FAQ sidebar content, share button labels, and SnapRow decoration labels are hardcoded in components and not editable by the owner in the CMS. These can be moved to registry fields in a later step if needed.
- **Icon keys**: Icon identifiers (`layers`, `smartphone`, `shield`, `globe`) use a select field with fixed options. The FAQ icon is currently a unicode emoji and is not editable.

## Sections defined

1. **hero** (4 fields)
2. **iam** (3 fields: prefix, words array, hint)
3. **channels** (5 fields: title, 3x channel with label+detail, newTab)
4. **teams** (1 field)
5. **proof** (1 field)
6. **why** (2 + 4x4=18 fields: title, subtitle, 4 why points with icon select, title, body)
7. **home** (4 nested sections: works, services, process, toolbox, faq; 10 fields)
8. **process** (array of 4 steps: 2 fields each = 8 fields)
9. **finalCta** (4 fields)
10. **faq** (variable questions array, each with question, intro, points array, outro)

## String Audit: About Page

Every user-visible string in components rendered by `/about` (Step 9).

| String | File | Classification | Section.field or Reason |
|--------|------|-----------------|------------------------|
| Now at {Site.org} | AboutHero.tsx | code-only | Site config, external link target |
| (opens in a new tab) | AboutHero.tsx | code-only | Screen reader helper for external link |
| Start a project | AboutHero.tsx | registry field | about.hero.primaryLabel |
| See my work | AboutHero.tsx | registry field | about.hero.secondaryLabel |
| A bit about me | AboutBento.tsx | registry field | about.bento.title |
| Who I Am | AboutBento.tsx | registry field | about.bento.cardTitle (from AboutContent.bento.B1.title) |
| I'm Sahan Sachintha... | AboutBento.tsx | registry field | about.bento.cardDescription (from AboutContent.bento.B1.description) |
| Companies and teams worked with | AboutBento.tsx | registry field | about.bento.companiesLabel |
| Freelance projects delivered | AboutBento.tsx | registry field | about.bento.freelanceLabel |
| Available for remote work | AvailableCard.tsx | registry field | about.bento.availabilityStatus |
| Email me | AvailableCard.tsx | registry field | about.bento.emailLabel |
| Send a message | AvailableCard.tsx | registry field | about.bento.messageLabel |
| GitHub Activity | GitHubStatsCard.tsx | registry field | about.bento.githubLabel |
| Contributions | GitHubStatsCard.tsx | registry field | about.bento.githubContributionsLabel |
| Public Repos | GitHubStatsCard.tsx | registry field | about.bento.githubReposLabel |
| Followers | GitHubStatsCard.tsx | registry field | about.bento.githubFollowersLabel |
| Contributions counted over the last year | GitHubStatsCard.tsx | registry field | about.bento.githubNote |
| Work experience | ExperienceSection.tsx | registry field | about.experience.title |
| Companies and engagements... | ExperienceSection.tsx | registry field | about.experience.description |
| Full-time | ExperienceSection.tsx | registry field | about.experience.typeLabelFulltime |
| Contract | ExperienceSection.tsx | registry field | about.experience.typeLabelContract |
| Part-time | ExperienceSection.tsx | registry field | about.experience.typeLabelParttime |
| Internship | ExperienceSection.tsx | registry field | about.experience.typeLabelInternship |
| Freelance | ExperienceSection.tsx | registry field | about.experience.typeLabelFreelance |
| Current | ExperienceSection.tsx | registry field | about.experience.currentBadge |
| (opens in a new tab) | ExperienceSection.tsx | code-only | Screen reader helper for company link |
| All services | ServiceSection.tsx | registry field | about.services.marqueeLabel |
| Discuss a project | ServiceBox.tsx | registry field | about.services.ctaLabel |
| Skillset Overview | SkillSection.tsx | registry field | about.skills.title |
| Areas of Expertise and Technical Proficiency | SkillSection.tsx | registry field | about.skills.description |
| Skill layout | SkillSection.tsx | code-only | Button group label for toggle |
| {category} skills | SkillSection.tsx | derived | Dynamic category name from MySkills categories |
| What I am | AboutHero.tsx | code-only | aria-label for role list |
| Service categories | ServiceBox.tsx | code-only | aria-label for category tab list |
| Skill categories | SkillSection.tsx | code-only | aria-label for skill category tab list |

## String Audit: Works and Updates Pages

Every user-visible string in components rendered by `/works` and `/updates`, classified by source.

## Works Page

| String | File | Classification | Section.field or reason |
|--------|------|-----------------|------------------------|
| `Products and client sites` | contents/works.ts | registry field | works.hero.status |
| `Work I have built and shipped.` | contents/works.ts | registry field | works.hero.title |
| `App-store products, client websites and the business systems behind them, such as POS and inventory. Open any project for its links and the story.` | contents/works.ts | registry field | works.hero.description |
| `Projects` | app/(site)/works/page.tsx | derived value | stat count label (from Project array length) |
| `Live right now` | app/(site)/works/page.tsx | derived value | stat count label (filtered Project count) |
| `Teams and clients` | app/(site)/works/page.tsx | derived value | stat count label (unique teamOf values) |
| `All work` | contents/works.ts | registry field | works.tabs[0].label |
| `Products` | contents/works.ts | registry field | works.tabs[1].label |
| `Client work` | contents/works.ts | registry field | works.tabs[2].label |
| `Kind of work` | components/works/WorksExplorer.tsx | code-only | aria-label for tab list |
| `Filter by platform` | components/works/WorksExplorer.tsx | code-only | aria-label for platform filter group |
| `Any platform` | components/works/WorksExplorer.tsx | code-only | platform filter "all" option label |
| `Any team` | components/works/WorksExplorer.tsx | code-only | team filter "all" option label |
| `Projects` | components/works/WorksExplorer.tsx | code-only | sr-only section heading (accessibility) |
| `Nothing to show for this filter yet.` | contents/works.ts | registry field | works.results.empty |
| `Behind the work` | contents/works.ts | registry field | works.behind.title |
| `The kind of problems these projects involved, and the tools used to solve them.` | contents/works.ts | registry field | works.behind.subtitle |
| `What I built across these products` | contents/works.ts | registry field | works.behind.capabilitiesLabel |
| `The stack behind them` | contents/works.ts | registry field | works.behind.stackLabel |
| `Cross-platform apps (Android, iOS, web)` | contents/works.ts | registry field | works.behind.capabilities[0] |
| `Dashboards and admin panels` | contents/works.ts | registry field | works.behind.capabilities[1] |
| `Property-finder APIs` | contents/works.ts | registry field | works.behind.capabilities[2] |
| `AI-assisted content tooling` | contents/works.ts | registry field | works.behind.capabilities[3] |
| `Multi-account Cloudinary media` | contents/works.ts | registry field | works.behind.capabilities[4] |
| `Redis caching` | contents/works.ts | registry field | works.behind.capabilities[5] |
| `Database backup and sync with fallbacks` | contents/works.ts | registry field | works.behind.capabilities[6] |
| `Multi-factor authentication` | contents/works.ts | registry field | works.behind.capabilities[7] |
| `Versioned content snapshots` | contents/works.ts | registry field | works.behind.capabilities[8] |
| `Scheduled cron jobs` | contents/works.ts | registry field | works.behind.capabilities[9] |
| `Client websites` | contents/works.ts | registry field | works.behind.capabilities[10] |
| `Booking-focused sites` | contents/works.ts | registry field | works.behind.capabilities[11] |
| `Point-of-sale systems` | contents/works.ts | registry field | works.behind.capabilities[12] |
| `Inventory management` | contents/works.ts | registry field | works.behind.capabilities[13] |
| `Learning management system` | contents/works.ts | registry field | works.behind.capabilities[14] |
| `Next.js` | contents/works.ts | registry field | works.behind.stack[0] |
| `React` | contents/works.ts | registry field | works.behind.stack[1] |
| `TypeScript` | contents/works.ts | registry field | works.behind.stack[2] |
| `Node.js` | contents/works.ts | registry field | works.behind.stack[3] |
| `NestJS` | contents/works.ts | registry field | works.behind.stack[4] |
| `Express` | contents/works.ts | registry field | works.behind.stack[5] |
| `PostgreSQL` | contents/works.ts | registry field | works.behind.stack[6] |
| `MongoDB` | contents/works.ts | registry field | works.behind.stack[7] |
| `Prisma` | contents/works.ts | registry field | works.behind.stack[8] |
| `Docker` | contents/works.ts | registry field | works.behind.stack[9] |
| `Vercel` | contents/works.ts | registry field | works.behind.stack[10] |
| `Cloudflare` | contents/works.ts | registry field | works.behind.stack[11] |
| `Figma` | contents/works.ts | registry field | works.behind.stack[12] |
| `Tailwind CSS` | contents/works.ts | registry field | works.behind.stack[13] |
| *FinalCta content* | lib/cms/pages/home (passed as prop) | registry field | shared section from home page |

## Updates Page

| String | File | Classification | Section.field or reason |
|--------|------|-----------------|------------------------|
| `Recent` | contents/updates.ts | registry field | updates.hero.w1 (first word) |
| `Updates` | contents/updates.ts | registry field | updates.hero.w2 (second word, highlighted in color) |
| `Stay Updated with My Latest Work & Moments` | contents/updates.ts | registry field | updates.hero.subtitle |
| `Search updates` | components/updates/UpdatesExplorer.tsx | code-only | search input placeholder |
| `Search updates` | components/updates/UpdatesExplorer.tsx | code-only | sr-only label for search input |
| `Topics` | contents/updates.ts | registry field | updates.filters.topics.title |
| `Tags` | contents/updates.ts | registry field | updates.filters.tags.title |
| `All` | components/updates/UpdatesExplorer.tsx | code-only | topics "all" option label |
| `Releases` | contents/updates.ts | derived value | topic name (from posts, never edited) |
| `Personal` | contents/updates.ts | derived value | topic name (from posts, never edited) |
| `Bug Fix` | contents/updates.ts | derived value | topic name (from posts, never edited) |
| `New Features` | contents/updates.ts | derived value | topic name (from posts, never edited) |
| `Other` | contents/updates.ts | derived value | topic name (from posts, never edited) |
| `#Next.js` | contents/updates.ts | derived value | tag (from posts, never edited) |
| `#React` | contents/updates.ts | derived value | tag (from posts, never edited) |
| `#SEO` | contents/updates.ts | derived value | tag (from posts, never edited) |
| `#Accessibility` | contents/updates.ts | derived value | tag (from posts, never edited) |
| `#Portfolio` | contents/updates.ts | derived value | tag (from posts, never edited) |
| `Showing N update(s)` | components/updates/UpdatesExplorer.tsx | code-only | sr-only live region text |
| `No updates match those filters.` | components/updates/UpdatesExplorer.tsx | derived value | empty state in filter UI (stays code for now, could be registry in future) |
| `Clear filters` | components/updates/UpdatesExplorer.tsx | code-only | button label for clearing filters |
| `Filter updates` | components/updates/UpdatesExplorer.tsx | code-only | aside aria-label (accessibility) |
| *Post titles and content* | contents/updates.ts | derived value | post data (managed in Step 12 blog system, not here) |
| *FinalCta content* | lib/cms/pages/home (passed as prop) | registry field | shared section from home page |

## Notes

- All `works.*` strings (hero, tabs, results, behind) are moved to the registry and editable via the admin panel.
- The `updates.hero` section is split into `w1`, `w2`, and `subtitle` to match the current markup structure where w2 is highlighted in color.
- The `updates.filters` section stores only the section titles (`topics.title`, `tags.title`); the icon enum stays in code.
- Tab `id` and `param` values stay in code to preserve old `?wt=` links.
- Stack names in `works.behind.stack` are looked up by name in `contents/skills.ts` at render time; a name with no match is silently skipped and does not crash.
- Topics and tags in the updates page are derived from posts, which remain in `contents/updates.ts` (not the registry) until Step 12 when they move to the database.
- Empty-state text in UpdatesExplorer ("No updates match those filters.") stays code-only for now since it is not customized per deployment.
- FinalCta is a shared section from the home page and is passed as a prop to both pages.

## Contact Page String Audit

Every user-visible string rendered by `/contact` (ContactForm, ContactDetailsCard, SocialMedia, tips, hero sections, ProcessSection).

| String | File | Classification | Section.field | Reason |
|--------|------|-----------------|---------------|--------|
| Replies come from me, not a bot | components/pages/ContactPageView | registry field | contact.hero.status | Status badge in hero |
| Let's talk about what you want to build. | components/pages/ContactPageView | registry field | contact.hero.title | H1 in hero |
| Tell me a little about it, or just say hi. Pick whichever channel is easiest for you. | components/pages/ContactPageView | registry field | contact.hero.description | Hero description paragraph |
| Email | components/contact/ContactDetailsCard | registry field | contact.details[email].label | Card title for email |
| Phone | components/contact/ContactDetailsCard | registry field | contact.details[phone].label | Card title for phone |
| WhatsApp | components/contact/ContactDetailsCard | registry field | contact.details[whatsapp].label | Card title for WhatsApp |
| Chat now | components/contact/ContactDetailsCard | registry field | contact.details[whatsapp].displayValue | WhatsApp card display text |
| Telegram | components/contact/ContactDetailsCard | registry field | contact.details[telegram].label | Card title for Telegram |
| Message me | components/contact/ContactDetailsCard | registry field | contact.details[telegram].displayValue | Telegram card display text |
| Location | components/contact/ContactDetailsCard | registry field | contact.details[location].label | Card title for location |
| A good first message includes | app/(site)/contact/page.tsx | registry field | contact.tips.title | Tips section heading |
| What you want built, in a sentence or two | app/(site)/contact/page.tsx | registry field | contact.tips.items | Tips list item |
| Who it is for, and where it will run (web, Android, iOS) | app/(site)/contact/page.tsx | registry field | contact.tips.items | Tips list item |
| Any deadline, and a rough budget if you have one | app/(site)/contact/page.tsx | registry field | contact.tips.items | Tips list item |
| Send a message | components/contact/ContactForm | registry field | contact.form.title | Form heading |
| This opens your own email or WhatsApp with the message already written. Nothing is sent until you press send there. | components/contact/ContactForm | registry field | contact.form.intro | Form intro text |
| Email | components/contact/ContactForm | registry field | contact.form.channels[email].label | Channel choice label (fixed id: email) |
| WhatsApp | components/contact/ContactForm | registry field | contact.form.channels[whatsapp].label | Channel choice label (fixed id: whatsapp) |
| Project | components/contact/ContactForm | registry field | contact.form.topicOptions | Topic option value |
| Idea | components/contact/ContactForm | registry field | contact.form.topicOptions | Topic option value |
| Just saying hi | components/contact/ContactForm | registry field | contact.form.topicOptions | Topic option value |
| Your name | components/contact/ContactForm | registry field | contact.form.fields.name.label | Name input label |
| Your email | components/contact/ContactForm | registry field | contact.form.fields.email.label | Email input label |
| you@example.com | components/contact/ContactForm | registry field | contact.form.fields.email.placeholder | Email input placeholder |
| What is this about? | components/contact/ContactForm | registry field | contact.form.fields.topic.label | Topic select label |
| Your message | components/contact/ContactForm | registry field | contact.form.fields.message.label | Message textarea label |
| A sentence or two helps me reply properly. | components/contact/ContactForm | registry field | contact.form.validation.message.minLength | Validation error message |
| Please tell me your name. | components/contact/ContactForm | registry field | contact.form.validation.name.required | Validation error message |
| Please add your email address. | components/contact/ContactForm | registry field | contact.form.validation.email.required | Validation error message |
| That email address does not look right. | components/contact/ContactForm | registry field | contact.form.validation.email.format | Validation error message |
| Send it with | components/contact/ContactForm | registry field | contact.form.legend | Fieldset legend for channel choice |
| Prepare my message | components/contact/ContactForm | registry field | contact.form.submitButtonText | Submit button label |
| Copy message | components/contact/ContactForm | registry field | contact.form.copyButtonText | Copy button label |
| Copied | components/contact/ContactForm | registry field | contact.form.copiedButtonText | Copy button label when copied |
| Your app should be open with the message ready. Press send there to finish. If nothing opened, use Copy message and paste it anywhere. | components/contact/ContactForm | registry field | contact.form.statusOpened | Status message when app opens |
| Message copied. Paste it into any chat or email. | components/contact/ContactForm | registry field | contact.form.statusCopied | Status message when message copied |
| Find me elsewhere | components/custom/contact/SocialMedia | registry field | contact.socials.title | Section heading |
| Code, career and the occasional thought. | components/custom/contact/SocialMedia | registry field | contact.socials.description | Section description |
| GitHub | components/custom/contact/SocialMedia | registry field | contact.socials.items[github].label | Social link label |
| LinkedIn | components/custom/contact/SocialMedia | registry field | contact.socials.items[linkedin].label | Social link label |
| X | components/custom/contact/SocialMedia | registry field | contact.socials.items[x].label | Social link label |
| https://github.com/ks-official-Sahan | components/custom/contact/SocialMedia | registry field | contact.socials.items[github].href | Social link URL |
| https://www.linkedin.com/in/sahan-sachintha | components/custom/contact/SocialMedia | registry field | contact.socials.items[linkedin].href | Social link URL |
| https://x.com/SahanSubasingha | components/custom/contact/SocialMedia | registry field | contact.socials.items[x].href | Social link URL |
| [email address from Site.email] | components/contact/ContactDetailsCard | derived value | Site.email | From config/site.ts |
| [phone from Site.phone] | components/contact/ContactDetailsCard | derived value | Site.phone | From config/site.ts |
| [formatted phone from Site.phoneDisplay] | components/contact/ContactDetailsCard | derived value | Site.phoneDisplay | From config/site.ts |
| [location from Site.location] | components/contact/ContactDetailsCard | derived value | Site.location | From config/site.ts |
| [WhatsApp URL from Site.whatsAppUrl] | components/contact/ContactDetailsCard | derived value | Site.whatsAppUrl | Derived from phone in config |
| [Telegram URL from Site.telegramUrl] | components/contact/ContactDetailsCard | derived value | Site.telegramUrl | Derived from phone in config |
| Copy email | components/contact/ContactDetailsCard | code-only | N/A | aria-label, screen reader only |
| Copy phone | components/contact/ContactDetailsCard | code-only | N/A | aria-label, screen reader only |
| (opens in a new tab) | components/contact/ContactDetailsCard | code-only | N/A | sr-only, assistive tech |
| Skip to content | components/site/SiteShell | code-only | N/A | sr-only skip link |
| Toggle navigation | components/site/Navigation | code-only | N/A | aria-label on menu button |
| Home, About, Works, Updates, Contact | app/(site)/layout.tsx | code-only | N/A | Navigation links (site config) |

## Notes

- **Channel IDs (fixed keys)**: `email`, `whatsapp` in `contact.form.channels[].id` are not editable
- **Social IDs (fixed keys)**: `github`, `linkedin`, `x` in `contact.socials.items[].id` are not editable; icon mapping stays in code
- **Derived values**: Email, phone, location, WhatsApp/Telegram URLs come from `config/site.ts` and move to a `site` CMS page in a later step
- **ProcessSection**: Shared with home page, owned by home agent; contact page receives it as content prop
- All form validation errors are editable registry fields
- Button states ("Copied" vs "Copy message") are editable
- Topic list comes from a fixed array of 3 options; channel list has 2 fixed options

