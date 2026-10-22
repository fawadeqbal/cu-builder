import { exampleCv, type CvExample } from "./types";

export const EDUCATION: CvExample[] = [
  {
    slug: "teacher",
    role: "Teacher",
    category: "Education",
    description: "A teacher CV example for schools in Pakistan, the Gulf and abroad, with results, curriculum, classroom practice and tips for international school applications.",
    intro: "Heads of school look for subject knowledge, results and how you run a classroom. Show your exam results and what you changed for your pupils.",
    template: "simple",
    accent: "#047857",
    cv: exampleCv("teacher", {
      name: "Amina Rauf",
      headline: "Physics Teacher (O and A Level)",
      email: "amina.rauf@example.com",
      phone: "+92 322 1234567",
      location: "Lahore, Pakistan",
      summary:
        "Physics teacher with seven years of experience teaching Cambridge O and A Level in private schools. Plans practical, well-paced lessons, tracks every pupil's progress and has raised A* to B results year after year. Looking for a role in an international school in the Gulf.",
      experience: [
        {
          role: "Physics Teacher, O and A Level",
          company: "Greenway Grammar School",
          location: "Lahore, Pakistan",
          date: "Aug 2020 – Present",
          bullets: [
            "Teach physics to five classes of 25–30 pupils in Years 9–13.",
            "Raised the share of A Level pupils getting A* to B from 48% to 71% over three years with weekly past-paper practice and targeted revision groups.",
            "Set up the school's first physics club and science fair, now joined by 60 pupils each year.",
            "Lead a department of three teachers on schemes of work and shared assessments.",
          ],
        },
        {
          role: "Science Teacher",
          company: "Riverside Public School",
          location: "Lahore, Pakistan",
          date: "Aug 2018 – Jul 2020",
          bullets: [
            "Taught general science and physics to Years 6–10 (Matric and O Level).",
            "Built a bank of 40 low-cost lab activities using everyday materials for classes without a full lab.",
          ],
        },
      ],
      skills: {
        Teaching: "Lesson planning, differentiation, formative assessment, practical work, exam preparation",
        Curriculum: "Cambridge O Level and A Level Physics, Matric science",
        Classroom: "Behaviour management, parent communication, pastoral care",
        Technology: "Google Classroom, PhET simulations, Microsoft Teams, Excel mark books",
      },
      education: [
        { degree: "MSc Physics", school: "Federal Valley University", date: "2015 – 2017" },
        { degree: "B.Ed", school: "Hillcrest College of Education", date: "2017 – 2018" },
      ],
      certificates: [{ name: "Cambridge Professional Development Qualification (PDQ), Teaching and Learning", issuer: "Cambridge Assessment International Education", year: "2023" }],
      languages: [
        ["English", "Fluent"],
        ["Urdu", "Native"],
      ],
    }),
    tips: [
      { title: "Put subject, level and curriculum in the headline", text: "“Physics Teacher (O and A Level)” tells a school straight away whether you fit their timetable and exam board." },
      { title: "Show exam results honestly", text: "Grade improvements, pass rates and value added are the strongest proof you can teach. Use cohort sizes so the numbers mean something." },
      { title: "Describe your classroom practice", text: "Mention how you plan, assess and support different learners, not just “excellent communication skills”." },
      { title: "Include clubs and leadership", text: "Clubs, trips, departments and mentoring show you'll add to school life beyond your lessons." },
      { title: "Add teaching qualifications and training", text: "B.Ed, PGCE, Cambridge PDQ or safeguarding training are filters for many international schools." },
    ],
    skills: ["Lesson planning", "Classroom management", "Differentiation", "Assessment and feedback", "Exam preparation", "Curriculum knowledge (Cambridge, IB, national)", "Parent communication", "Pastoral care", "EdTech (Google Classroom, Teams)", "Safeguarding"],
    sampleSummary: {
      label: "For a primary school teacher",
      text: "Primary teacher with four years of experience in Grades 1–5, teaching English, maths and science. Builds calm, cheerful classrooms where every child reads every day, and keeps parents involved with weekly updates.",
    },
    faqs: [
      { q: "Do international schools want a photo on a teacher CV?", a: "Many Gulf schools expect one, while UK schools usually don't. Follow the school's application instructions." },
      { q: "Should I list safeguarding training?", a: "Yes. International schools increasingly require it. Add the course and the year in certificates." },
    ],
  },
];

export const EARLY_CAREER: CvExample[] = [
  {
    slug: "fresh-graduate",
    role: "Fresh graduate",
    category: "Early career",
    description: "A fresh graduate CV example that turns university projects, internships and activities into real experience, with tips for your first job.",
    intro: "With little work experience, your projects, internship and activities are your experience. Write them the same way: what you did and what came of it.",
    template: "classic",
    accent: "#1e4b8f",
    cv: exampleCv("fresh-graduate", {
      name: "Abdullah Khan",
      headline: "Business Graduate, Finance and Analytics",
      email: "abdullah.khan@example.com",
      phone: "+92 311 1234567",
      location: "Islamabad, Pakistan",
      summary:
        "BBA graduate in finance with a three-month internship in corporate banking and strong Excel and Power BI skills. Led a 12-person student society and a final-year project that a local business now uses. Looking for a management trainee or analyst role.",
      experience: [
        {
          role: "Corporate Banking Intern",
          company: "Kestrel Commercial Bank",
          location: "Islamabad, Pakistan",
          date: "Jun 2025 – Aug 2025",
          bullets: [
            "Prepared credit summaries for 15 corporate clients from their financial statements.",
            "Built an Excel tracker for loan renewals that the team kept using after the internship.",
          ],
        },
      ],
      projects: [
        {
          name: "Final-year project: cash-flow forecast for a family business",
          date: "2025",
          bullets: [
            "Built a 12-month cash-flow model and Power BI dashboard for a local furniture maker with 40 staff.",
            "The owner used it to time a PKR 3 million machine purchase without a bank overdraft.",
          ],
        },
        {
          name: "President, Finance Society",
          date: "2024 – 2025",
          bullets: ["Led a 12-person committee that ran 8 events and a stock-market simulation with 300 student participants."],
        },
      ],
      skills: {
        Finance: "Financial statement analysis, budgeting, cash-flow forecasting, ratio analysis",
        Tools: "Excel (pivot tables, XLOOKUP), Power BI, PowerPoint",
        "Working with people": "Presenting, event organising, team leadership",
      },
      education: [{ degree: "BBA (Hons), Finance", school: "Federal Valley University", date: "2021 – 2025", details: "CGPA 3.6 / 4.0 · Dean's list, two semesters" }],
      certificates: [{ name: "Financial Modelling Fundamentals", issuer: "Example Online Academy", year: "2025" }],
      languages: [
        ["English", "Fluent"],
        ["Urdu", "Native"],
        ["Pashto", "Native"],
      ],
    }),
    tips: [
      { title: "Lead with your strongest proof", text: "If your internship is your best experience, put it first. If your project is stronger, put projects above experience." },
      { title: "Write projects like jobs", text: "Give each project a title, date and two achievement lines. Say who used it or what it changed, like a real client would." },
      { title: "Add your CGPA if it helps", text: "Include it if it's 3.0 out of 4.0 or above, along with honours or scholarships. Leave it off if it doesn't help." },
      { title: "Show leadership and teamwork", text: "Societies, sports captaincy, volunteering and part-time jobs prove skills employers want from graduates." },
      { title: "Keep it to one page", text: "A focused one-page CV reads better than two pages of coursework. Cut anything that doesn't support the job you want." },
    ],
    skills: ["Excel", "Data analysis", "Presentation skills", "Teamwork", "Leadership", "Written communication", "Problem solving", "Time management", "Research", "Willingness to learn"],
    sampleSummary: {
      label: "For an engineering graduate",
      text: "Electrical engineering graduate with a six-week internship at a power distribution company and a final-year project on solar inverter efficiency. Comfortable with MATLAB, AutoCAD and site safety basics, and ready for a graduate engineer role.",
    },
    faqs: [
      { q: "What should a fresh graduate put on a CV with no experience?", a: "Projects, internships, part-time work, volunteering and student societies all count. Describe each with what you did and what came of it." },
      { q: "Should I write an objective or a summary?", a: "A short summary works better: who you are, your best skills and the role you want, in two or three sentences." },
      { q: "Do I need to list my matric and intermediate results?", a: "Your degree is enough for most jobs. Add earlier results only if they're strong and the employer asks for them." },
    ],
  },
  {
    slug: "internship",
    role: "Internship",
    category: "Early career",
    description: "An internship CV example for university students, built around coursework projects, skills and activities, with tips to stand out for your first internship.",
    intro: "Internship recruiters know you're still learning. They want proof that you're curious, reliable and already building things.",
    template: "compact",
    accent: "#4338ca",
    cv: exampleCv("internship", {
      name: "Laiba Shahid",
      headline: "Computer Science Student, Software Engineering Internship",
      email: "laiba.shahid@example.com",
      phone: "+92 303 1234567",
      location: "Lahore, Pakistan",
      website: "laiba.example.com",
      summary:
        "Third-year computer science student looking for a summer software engineering internship. Builds web apps with React and Node.js, has shipped two projects that classmates use, and ranks in the top 10% of her class.",
      projects: [
        {
          name: "Campus Bus Tracker",
          date: "2025",
          links: ["laiba.example.com/bus"],
          bullets: [
            "Built a web app that shows where the university buses are, using drivers' phone GPS and a Node.js API.",
            "Used by about 400 students a week; cut questions to the transport office by half.",
          ],
          stack: "React, Node.js, Express, MongoDB, Leaflet",
        },
        {
          name: "Study Planner",
          date: "2024",
          bullets: ["Built a timetable and assignment planner with reminders; won second place at the department's software fair."],
          stack: "React, Firebase",
        },
      ],
      experience: [
        {
          role: "Teaching Assistant, Programming Fundamentals",
          company: "Ravi Institute of Technology",
          location: "Lahore, Pakistan",
          date: "Sep 2024 – Present",
          bullets: ["Run weekly lab sessions for 35 first-year students and mark their C++ assignments."],
        },
      ],
      skills: {
        Programming: "JavaScript, TypeScript, Python, C++, SQL",
        Web: "React, Node.js, Express, HTML, CSS",
        Tools: "Git, GitHub, VS Code, Firebase, Figma (basic)",
      },
      education: [{ degree: "BS Computer Science (third year)", school: "Ravi Institute of Technology", date: "2023 – 2027", details: "CGPA 3.7 / 4.0 · Relevant courses: Data Structures, Databases, Web Engineering" }],
      languages: [
        ["English", "Fluent"],
        ["Urdu", "Native"],
      ],
    }),
    tips: [
      { title: "Put projects before experience", text: "For most students, projects are the strongest evidence. Lead with the two or three you're proudest of, with a link." },
      { title: "Say who used what you built", text: "Users, classmates, a club or a competition result turns a coursework project into real experience." },
      { title: "List relevant courses", text: "Two or three courses that match the internship help with keyword filters and show what you've studied." },
      { title: "Include campus roles", text: "Teaching assistant, society or volunteer roles show responsibility and reliability, which matter for interns." },
      { title: "Say when you're available", text: "Add your graduation year and, in your email or summary, the months you can intern." },
    ],
    skills: ["Programming fundamentals", "Web development", "Git and GitHub", "Problem solving", "Databases (SQL)", "Teamwork", "Communication", "Quick learning", "Time management", "Attention to detail"],
    sampleSummary: {
      label: "For a business internship",
      text: "Second-year BBA student looking for a marketing internship. Runs social media for the university's entrepreneurship society, grew its followers from 800 to 3,500 in a year, and is comfortable with Canva, Excel and presenting to groups.",
    },
    faqs: [
      { q: "Can I apply for an internship with no experience?", a: "Yes. Internships exist for students without experience. Show projects, coursework, campus roles and why you want this internship." },
      { q: "Should an internship CV be one page?", a: "Yes. One page is the norm for students. Keep the most relevant projects and cut school-level details." },
    ],
  },
];
