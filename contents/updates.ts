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
            updates: 20
        },
        {
            id: 2,
            name: "Personal",
            updates: 15
        },
        {
            id: 3,
            name: "Bug Fix",
            updates: 46
        },
        {
            id: 4,
            name: "New Features",
            updates: 10
        },
        {
            id: 5,
            name: "Other",
            updates: 5
        }
    ],
    tags: ["Nest.js", "Next.js", "React", "Node.js"],
    posts: [
        {
            id: "1",
            title: "Introducing Our New Product",
            date: "July 15, 2023",
            content: "Introducing our latest product, XYZ, which offers a unique blend of cutting-edge technology and sustainable practices. This revolutionary solution will help businesses achieve their goals while minimizing environmental impact.",
            topic: "Releases",
            tags: ["Nest.js", "Next.js"]
        },
        {
            id: "2",
            title: "Launching Our New Website",
            date: "July 10, 2023",
            content: "We are thrilled to announce the launch of our new website, www.xyz.com. This revolutionary platform will provide our users with a more engaging and accessible experience, while also empowering them to create their own unique content.",
            topic: "Releases",
            tags: ["Nest.js", "Next.js"]
        },
        {
            id: "3",
            title: "New Webinar Series on Sustainable Development",
            date: "July 5, 2023",
            content: "We have just launched a new webinar series on sustainable development.",
            topic: "Personal",
            tags: ["Nest.js", "Next.js"]
        }
    ]
}