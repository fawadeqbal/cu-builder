import type { CV } from "./types";

/** Example CV shown on first visit. Replace it with your own details or import a JSON file. */
export const sampleCV: CV = {
  personal: {
    name: "Sara Ahmed",
    headline: "Full Stack Developer",
    tagline: "React · Next.js · Node.js · PostgreSQL · Docker",
    phone: "+92 300 1234567",
    email: "sara.ahmed@example.com",
    location: "Lahore, Pakistan",
    website: "saraahmed.dev",
    github: "github.com/sara-ahmed",
    linkedin: "linkedin.com/in/sara-ahmed",
    extra: "",
  },
  summary:
    "Full stack developer with four years of experience building web applications with React, Next.js and Node.js. Comfortable owning a feature end to end, from database design and REST APIs to responsive, accessible interfaces, and shipping it with Docker and CI/CD. Enjoys turning messy business workflows into simple tools people actually use.",
  experience: [
    {
      id: "exp-1",
      role: "Full Stack Developer",
      company: "Bright Labs",
      location: "Lahore, Pakistan",
      date: "Mar 2024 – Present",
      bullets: [
        "Build and maintain a multi-tenant booking platform used by 120+ clinics, with a Node.js API and a Next.js dashboard.",
        "Designed the PostgreSQL schema and indexes for appointments and payments, cutting the slowest report query from 4 s to 300 ms.",
        "Added role-based access control and audit logs for admin, staff and patient accounts.",
        "Set up GitHub Actions pipelines that test, build and deploy Docker images on every merge.",
      ],
      stack: "Next.js, React, Node.js, Express, PostgreSQL, Prisma, Docker, GitHub Actions",
    },
    {
      id: "exp-2",
      role: "Frontend Developer",
      company: "Pixel Works",
      location: "Remote",
      date: "Jun 2022 – Feb 2024",
      bullets: [
        "Turned Figma designs into a reusable React component library shared by three products.",
        "Improved Lighthouse performance scores from 62 to 94 with code splitting and image optimization.",
      ],
      stack: "React, TypeScript, Tailwind CSS, Storybook",
    },
  ],
  projects: [
    {
      id: "proj-1",
      name: "TaskFlow — Team Task Board",
      date: "2025",
      links: ["https://github.com/sara-ahmed/taskflow"],
      bullets: [
        "Kanban board with drag and drop, assignees and a 'My tasks' filter; status changes save instantly with optimistic updates.",
        "JWT authentication and a documented REST API with Express and MongoDB.",
      ],
      stack: "React, Tailwind CSS, Express, MongoDB, dnd-kit",
    },
    {
      id: "proj-2",
      name: "ShopLite — E-commerce Store",
      date: "2024",
      links: ["https://shoplite.example.com"],
      bullets: [
        "Storefront with product search, cart and Stripe checkout, plus an admin panel for products and orders.",
      ],
      stack: "Next.js, PostgreSQL, Stripe, Docker",
    },
  ],
  skills: [
    { id: "skill-1", category: "Frontend", items: "React, Next.js, TypeScript, Tailwind CSS, TanStack Query" },
    { id: "skill-2", category: "Backend", items: "Node.js, Express, NestJS, REST APIs, JWT" },
    { id: "skill-3", category: "Databases", items: "PostgreSQL, Prisma, MongoDB, Redis" },
    { id: "skill-4", category: "DevOps", items: "Docker, GitHub Actions, Nginx, Linux" },
  ],
  education: [
    {
      id: "edu-1",
      degree: "BS Computer Science",
      school: "University of the Punjab",
      date: "2018 – 2022",
      details: "Lahore, Pakistan · CGPA 3.4 / 4.0",
    },
  ],
  certificates: [
    { id: "cert-1", name: "AWS Cloud Practitioner", issuer: "Amazon Web Services", year: "2024", url: "" },
  ],
  languages: [
    { id: "lang-1", name: "English", level: "Professional working proficiency" },
    { id: "lang-2", name: "Urdu", level: "Native" },
  ],
};
