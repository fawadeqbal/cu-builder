import { exampleCv, type CvExample } from "./types";

export const FINANCE: CvExample[] = [
  {
    slug: "accountant",
    role: "Accountant",
    category: "Finance",
    description: "An accountant CV example for Gulf and international roles, with month-end close, VAT and audit work, and tips on qualifications and ERP systems.",
    intro: "Finance managers look for accuracy, deadlines met and the systems you know. This example shows all three with numbers a reader can check in an interview.",
    template: "classic",
    accent: "#1f2a44",
    cv: exampleCv("accountant", {
      name: "Imran Sheikh",
      headline: "Accountant (ACCA)",
      tagline: "Month-end close · UAE VAT · IFRS · SAP",
      email: "imran.sheikh@example.com",
      phone: "+971 55 123 4567",
      location: "Sharjah, UAE",
      summary:
        "ACCA-qualified accountant with seven years of experience in general ledger, month-end close and UAE VAT for trading and manufacturing companies. Closes the books on time, keeps audit files clean and has moved two finance teams from spreadsheets to ERP. Holds a transferable UAE residence visa.",
      experience: [
        {
          role: "Senior Accountant",
          company: "Gulfline Trading LLC",
          location: "Sharjah, UAE",
          date: "Mar 2021 – Present",
          bullets: [
            "Run the month-end close for three entities with combined revenue of AED 180 million, cutting the close from 12 to 6 working days.",
            "Prepare quarterly UAE VAT returns and handled a Federal Tax Authority review with no penalties.",
            "Led the finance side of the move from spreadsheets to SAP Business One, including chart of accounts and opening balances.",
            "Prepared the audit file for Big Four auditors; the last two audits closed with no material adjustments.",
          ],
        },
        {
          role: "Accountant",
          company: "Boxwell Packaging Industries",
          location: "Lahore, Pakistan",
          date: "Jul 2017 – Feb 2021",
          bullets: [
            "Handled accounts payable for 300 suppliers and reconciled 14 bank accounts every month.",
            "Built a cost sheet for each product line that showed two loss-making SKUs; management repriced them within a quarter.",
          ],
        },
      ],
      skills: {
        Accounting: "General ledger, month-end close, reconciliations, fixed assets, accruals, IFRS",
        Tax: "UAE VAT returns, corporate tax basics, withholding tax (Pakistan)",
        Systems: "SAP Business One, Oracle NetSuite, QuickBooks, Excel (pivot tables, XLOOKUP, Power Query)",
        Reporting: "Management accounts, budgeting, variance analysis, audit support",
      },
      education: [{ degree: "BCom (Hons) Accounting and Finance", school: "Northfield College of Commerce", date: "2013 – 2017" }],
      certificates: [
        { name: "ACCA (Association of Chartered Certified Accountants)", issuer: "ACCA", year: "2020" },
        { name: "UAE VAT Compliance", issuer: "Example Tax Academy", year: "2022" },
      ],
      languages: [
        ["English", "Fluent"],
        ["Urdu", "Native"],
      ],
      details: { nationality: "Pakistani", visaStatus: "UAE residence visa (transferable)", drivingLicence: "UAE driving licence" },
      settings: { region: "gulf" },
    }),
    tips: [
      { title: "Put your qualification next to your name", text: "“Accountant (ACCA)” or “ACA, CA Inter” in the headline gets past filters that screen for qualifications first." },
      { title: "Quantify size and speed", text: "Revenue or transaction volume, number of entities and days to close tell a manager the scale you can handle." },
      { title: "Name the ERP and the standards", text: "SAP, Oracle, NetSuite, QuickBooks, IFRS and local tax rules are the keywords recruiters search for. Put them in your skills and your bullets." },
      { title: "Show clean audits and compliance", text: "No penalties, no material adjustments, returns filed on time: these are the outcomes finance leaders care about most." },
      { title: "In the Gulf, add visa and licence status", text: "Recruiters there often filter by visa status and notice period. One line in your personal details saves a phone call." },
    ],
    skills: ["General ledger", "Month-end close", "Bank reconciliations", "IFRS", "VAT and tax returns", "Accounts payable and receivable", "ERP (SAP, Oracle, NetSuite)", "Advanced Excel", "Budgeting and variance analysis", "Audit support"],
    sampleSummary: {
      label: "For a part-qualified accountant",
      text: "Part-qualified ACCA accountant with two years of experience in accounts payable and bank reconciliations. Accurate, organised and comfortable in QuickBooks and Excel, with six ACCA papers passed and studying for the rest.",
    },
    faqs: [
      { q: "Should I list ACCA papers I've passed?", a: "Yes, if you're part-qualified. Write “ACCA: 9 of 13 exams passed” so recruiters can see where you are." },
      { q: "Do Gulf employers expect personal details on an accountant CV?", a: "Many do: nationality, visa status and sometimes date of birth. Add only what you're comfortable sharing; it's never required by law." },
    ],
  },
  {
    slug: "bank-officer",
    role: "Bank officer",
    category: "Finance",
    description: "A bank officer CV example for branch banking roles, with deposits, customer service and compliance results, plus tips for banking applications.",
    intro: "Banks hire for trust and targets. Show that you grow the branch's business and follow the rules, in that order of detail.",
    template: "compact",
    accent: "#047857",
    cv: exampleCv("bank-officer", {
      name: "Sana Javed",
      headline: "Relationship Officer, Branch Banking",
      email: "sana.javed@example.com",
      phone: "+92 302 1234567",
      location: "Karachi, Pakistan",
      summary:
        "Branch banking officer with five years of experience in account opening, deposits and consumer products. Consistently above deposit targets, careful with KYC and AML checks, and trusted by high-value customers. Ready to move into a branch operations or relationship manager role.",
      experience: [
        {
          role: "Relationship Officer",
          company: "Harbourside Bank Limited",
          location: "Karachi, Pakistan",
          date: "Jan 2022 – Present",
          bullets: [
            "Grew the branch's current and savings deposits by PKR 420 million in 2024, 130% of the annual target.",
            "Manage a portfolio of 180 priority customers, keeping complaints at zero over the last 18 months.",
            "Cross-sold 95 credit cards and 40 bancassurance policies through needs-based conversations, not cold calls.",
            "Scored 100% on two internal compliance audits of account-opening and KYC files.",
          ],
        },
        {
          role: "Customer Services Officer",
          company: "Kestrel Commercial Bank",
          location: "Karachi, Pakistan",
          date: "Aug 2019 – Dec 2021",
          bullets: [
            "Opened 60–80 accounts a month and handled walk-in queries, cheque books, cards and internet banking.",
            "Trained four new staff on core banking screens and the bank's KYC checklist.",
          ],
        },
      ],
      skills: {
        Banking: "Account opening, deposits, consumer products, remittances, trade basics",
        Compliance: "KYC, AML/CFT, CDD, State Bank of Pakistan regulations",
        Sales: "Cross-selling, portfolio management, customer retention",
        Systems: "Temenos T24, MS Excel, MS Office",
      },
      education: [
        { degree: "MBA Banking and Finance", school: "Seaview Business School", date: "2017 – 2019" },
        { degree: "BBA", school: "Seaview Business School", date: "2013 – 2017" },
      ],
      certificates: [{ name: "Institute of Bankers Pakistan (JAIBP) Stage 1", issuer: "IBP", year: "2021" }],
      languages: [
        ["English", "Fluent"],
        ["Urdu", "Native"],
        ["Sindhi", "Conversational"],
      ],
    }),
    tips: [
      { title: "Lead with targets met", text: "Deposits mobilised, accounts opened and products sold as a percentage of target are the first numbers a branch manager looks for." },
      { title: "Show you follow the rules", text: "KYC, AML and audit scores matter as much as sales in banking. One clear line on compliance builds trust." },
      { title: "Describe your customers", text: "Portfolio size, customer type (retail, priority, SME) and complaint record show the relationships you can be trusted with." },
      { title: "Name the core banking system", text: "Temenos T24, Finacle or the bank's own system are keywords that tell HR you'll need less training." },
    ],
    skills: ["Customer relationship management", "Deposit mobilisation", "Cross-selling", "KYC and AML", "Account opening", "Branch operations", "Core banking (T24, Finacle)", "Complaint handling", "MS Excel", "Regulatory compliance"],
    sampleSummary: {
      label: "For a management trainee applicant",
      text: "MBA (Finance) graduate with a banking internship in branch operations and account opening. Comfortable with numbers and customers, careful with procedures, and keen to join a management trainee programme.",
    },
    faqs: [
      { q: "Should I include my MBA grades on a banking CV?", a: "Include your CGPA if it's strong (3.0+ out of 4.0) and you're early in your career. After a few years, your results at work matter more." },
      { q: "What if I missed a target?", a: "You don't need to list every target. Pick the periods and products where you did well, and be ready to talk honestly about the others." },
    ],
  },
];

export const HEALTHCARE: CvExample[] = [
  {
    slug: "nurse",
    role: "Nurse",
    category: "Healthcare",
    description: "A registered nurse CV example for hospital roles in Pakistan, the Gulf and the UK, with ward experience, licences and patient-safety results.",
    intro: "Nursing CVs are checked for licences first and clinical experience second. Make both easy to find, then show the care you give.",
    template: "classic",
    accent: "#0e7490",
    cv: exampleCv("nurse", {
      name: "Ayesha Noor",
      headline: "Registered Nurse (Medical-Surgical)",
      email: "ayesha.noor@example.com",
      phone: "+92 312 1234567",
      location: "Lahore, Pakistan",
      summary:
        "Registered nurse with six years of experience on busy medical-surgical and cardiac wards. Calm with acutely ill patients, careful with medicines and documentation, and a trusted mentor to new nurses. Holds a PNC licence, BLS and ACLS, and has passed the NCLEX-RN for overseas registration.",
      experience: [
        {
          role: "Staff Nurse, Cardiac Ward",
          company: "Riverside Heart Centre",
          location: "Lahore, Pakistan",
          date: "Apr 2021 – Present",
          bullets: [
            "Care for 6–8 cardiac patients a shift, including post-angioplasty monitoring, telemetry and IV medicines.",
            "Introduced a bedside handover checklist on the ward; medication incidents fell from 9 to 2 a quarter.",
            "Preceptor for 12 newly qualified nurses on their first three months.",
            "Member of the hospital's rapid response team; respond to 15–20 deteriorating-patient calls a month.",
          ],
        },
        {
          role: "Staff Nurse, Medical-Surgical Ward",
          company: "Northgate General Hospital",
          location: "Lahore, Pakistan",
          date: "Jan 2019 – Mar 2021",
          bullets: [
            "Provided pre- and post-operative care for up to 10 patients a shift on a 40-bed ward.",
            "Cared for COVID-19 patients on a converted isolation ward during 2020, including oxygen therapy and proning.",
          ],
        },
      ],
      skills: {
        Clinical: "Patient assessment, IV cannulation, medication administration, wound care, telemetry, post-operative care",
        Emergency: "BLS, ACLS, rapid response, early warning scores",
        Safety: "Infection control, safe handover, incident reporting, documentation",
        Systems: "Electronic health records, MS Office",
      },
      education: [{ degree: "BSc Nursing (Generic, 4 years)", school: "Riverside College of Nursing", date: "2014 – 2018" }],
      certificates: [
        { name: "Registered Nurse licence", issuer: "Pakistan Nursing and Midwifery Council", year: "2018" },
        { name: "NCLEX-RN (passed)", issuer: "NCSBN", year: "2024" },
        { name: "Advanced Cardiac Life Support (ACLS)", issuer: "American Heart Association", year: "2025" },
        { name: "Basic Life Support (BLS)", issuer: "American Heart Association", year: "2025" },
      ],
      languages: [
        ["English", "IELTS 7.5 (Academic)"],
        ["Urdu", "Native"],
        ["Punjabi", "Native"],
      ],
    }),
    tips: [
      { title: "Put licences and life support near the top", text: "Registration, BLS, ACLS and exams like NCLEX, OET or Prometric are the first things nursing recruiters check. Include the year so they can see they're current." },
      { title: "Name the ward and the patient load", text: "“Cardiac ward, 6–8 patients a shift” tells a recruiter far more than “hospital nurse”." },
      { title: "Show patient-safety results", text: "Fewer medication errors, falls or pressure injuries are the nursing equivalent of a sales target. Use your ward's real figures." },
      { title: "Mention teaching and teamwork", text: "Preceptoring, rapid response teams and committees show you're ready for more responsibility." },
      { title: "Add your English test for overseas roles", text: "For the UK, Gulf or Australia, put your IELTS or OET score in languages, with the date." },
    ],
    skills: ["Patient assessment", "Medication administration", "IV therapy", "Wound care", "Infection prevention and control", "BLS and ACLS", "Electronic health records", "Patient education", "Critical thinking", "Team communication"],
    sampleSummary: {
      label: "For a newly qualified nurse",
      text: "Newly registered nurse with clinical placements in medical, surgical and paediatric wards. Careful with medicines and documentation, kind under pressure and quick to learn ward routines. BLS certified and preparing for the OET.",
    },
    faqs: [
      { q: "What do Gulf hospitals look for on a nursing CV?", a: "Your licence, years of post-registration experience, the specialty, and your Prometric or DataFlow status. Put them where they can be seen in seconds." },
      { q: "Should I list every clinical skill?", a: "List the skills the job advert asks for and the ones specific to your specialty. Everyday basics can be grouped in one line." },
    ],
  },
  {
    slug: "doctor",
    role: "Doctor",
    category: "Healthcare",
    description: "A doctor CV example for hospital posts in the Gulf and abroad, with training, procedures, audits and licences laid out the way medical recruiters read them.",
    intro: "A medical CV is read in a fixed order: registration, training, clinical experience, then audit, teaching and research. This example follows that order.",
    template: "simple",
    accent: "#1e4b8f",
    cv: exampleCv("doctor", {
      name: "Dr Faisal Rehman",
      headline: "Specialist Internal Medicine (FCPS)",
      email: "faisal.rehman@example.com",
      phone: "+966 50 123 4567",
      location: "Riyadh, Saudi Arabia",
      summary:
        "Internal medicine specialist with nine years of clinical experience, including four years after FCPS in busy tertiary hospitals in Pakistan and Saudi Arabia. Manages complex inpatients, runs a weekly diabetes clinic and leads audits that change practice. Licensed by the Saudi Commission for Health Specialties.",
      experience: [
        {
          role: "Specialist, Internal Medicine",
          company: "Palm Crest Medical City",
          location: "Riyadh, Saudi Arabia",
          date: "Sep 2022 – Present",
          bullets: [
            "Lead a team of three residents caring for 25–30 medical inpatients and take part in the on-call rota for emergency admissions.",
            "Run a weekly diabetes and endocrine clinic seeing about 40 patients.",
            "Led an audit of sepsis care that raised antibiotics-within-one-hour from 54% to 86% over six months.",
            "Teach residents and interns at weekly case presentations and journal clubs.",
          ],
        },
        {
          role: "Senior Registrar, Medicine",
          company: "Westbridge Teaching Hospital",
          location: "Lahore, Pakistan",
          date: "Jan 2019 – Aug 2022",
          bullets: [
            "Managed acute medical admissions and the medical high-dependency unit on a 60-bed unit.",
            "Performed ultrasound-guided procedures including paracentesis, thoracentesis and central lines.",
          ],
        },
        {
          role: "Postgraduate Resident, Medicine",
          company: "Westbridge Teaching Hospital",
          location: "Lahore, Pakistan",
          date: "Jan 2015 – Dec 2018",
          bullets: ["Completed four-year FCPS training in internal medicine with rotations in cardiology, nephrology, gastroenterology and ICU."],
        },
      ],
      skills: {
        Clinical: "Acute medicine, diabetes and endocrinology, sepsis management, high-dependency care",
        Procedures: "Central venous lines, paracentesis, thoracentesis, lumbar puncture, point-of-care ultrasound",
        "Quality and teaching": "Clinical audit, guideline writing, resident teaching, morbidity and mortality reviews",
      },
      education: [
        { degree: "FCPS Internal Medicine", school: "College of Physicians and Surgeons Pakistan", date: "2019" },
        { degree: "MBBS", school: "Fatima Valley Medical College", date: "2008 – 2013" },
      ],
      certificates: [
        { name: "Saudi Commission for Health Specialties – Specialist licence", issuer: "SCFHS", year: "2022" },
        { name: "Pakistan Medical and Dental Council registration", issuer: "PMDC", year: "2014" },
        { name: "Advanced Cardiac Life Support (ACLS)", issuer: "American Heart Association", year: "2024" },
      ],
      languages: [
        ["English", "Fluent"],
        ["Urdu", "Native"],
        ["Arabic", "Clinical basics"],
      ],
      details: { nationality: "Pakistani" },
      settings: { region: "gulf" },
    }),
    tips: [
      { title: "Lead with registration and qualifications", text: "Put your licences (PMDC, SCFHS, DHA, GMC) with numbers or dates where the job asks for them, and your postgraduate qualification in the headline." },
      { title: "List training posts in order", text: "Medical recruiters expect every post, with dates and specialty, and they notice gaps. Explain any gap in one line." },
      { title: "Give your caseload", text: "Beds, clinic sizes, on-call duties and team size show the level you work at better than a list of conditions." },
      { title: "Show audit and quality work with results", text: "Name the audit and the change it made, for example a rise in sepsis bundle compliance. This is what separates candidates at interview." },
      { title: "Keep research and publications short", text: "Unless you're applying for an academic post, list two or three of your strongest papers and offer the full list on request." },
    ],
    skills: ["Clinical assessment and diagnosis", "Acute and emergency medicine", "Clinical procedures", "Clinical audit", "Evidence-based practice", "Teaching and supervision", "Multidisciplinary teamwork", "Patient communication", "Medical documentation", "ACLS"],
    sampleSummary: {
      label: "For a house officer applying for residency",
      text: "MBBS graduate who has completed a one-year house job in medicine and surgery at a busy teaching hospital. Confident with ward rounds, admissions and basic procedures, and preparing for FCPS Part 1 to start residency in internal medicine.",
    },
    faqs: [
      { q: "How long should a doctor's CV be?", a: "Two to four pages is normal for doctors because training posts, licences and audits all need listing. Keep each line short so it stays easy to scan." },
      { q: "Should I include my licence numbers?", a: "Include them if the job advert asks or the hospital needs them to check registration. Otherwise the licence name and year is enough." },
      { q: "Is the company name here a real hospital?", a: "No. Every name, hospital and number in this example is made up to show the format." },
    ],
  },
  {
    slug: "pharmacist",
    role: "Pharmacist",
    category: "Healthcare",
    description: "A pharmacist CV example for hospital and retail pharmacy, with dispensing, clinical review and inventory results, plus tips on licences.",
    intro: "Pharmacy managers want safe dispensing, sharp clinical checks and tidy stock. Show all three with figures you can explain.",
    template: "compact",
    accent: "#0f766e",
    cv: exampleCv("pharmacist", {
      name: "Hira Aslam",
      headline: "Clinical Pharmacist (Pharm-D)",
      email: "hira.aslam@example.com",
      phone: "+974 5512 3456",
      location: "Doha, Qatar",
      summary:
        "Clinical pharmacist with five years of hospital and retail experience. Reviews prescriptions for interactions and dosing, counsels patients clearly and keeps stock and controlled drugs in order. Licensed by the Qatar Ministry of Public Health and the Pharmacy Council of Pakistan.",
      experience: [
        {
          role: "Clinical Pharmacist",
          company: "Pearl Bay Hospital",
          location: "Doha, Qatar",
          date: "Jun 2022 – Present",
          bullets: [
            "Review 150–200 inpatient prescriptions a day for dosing, interactions and allergies, with about 20 interventions accepted by doctors each week.",
            "Run renal dose adjustment checks for the medical wards; avoidable dosing errors in audit fell by 60%.",
            "Counsel patients on discharge medicines, including inhalers, insulin and anticoagulants.",
          ],
        },
        {
          role: "Pharmacist in Charge",
          company: "Fernhill Pharmacy Chain",
          location: "Islamabad, Pakistan",
          date: "Mar 2020 – May 2022",
          bullets: [
            "Managed a pharmacy dispensing 400+ prescriptions a day with a team of five.",
            "Cut expired stock write-offs by 35% with first-expiry-first-out checks and monthly stock counts.",
            "Kept controlled-drug records audit-ready; passed every inspection by the drug regulatory authority.",
          ],
        },
      ],
      skills: {
        Clinical: "Prescription review, drug interactions, renal and hepatic dosing, anticoagulation, patient counselling",
        Operations: "Dispensing, inventory control, controlled drugs, cold chain",
        Systems: "Cerner pharmacy module, Excel, pharmacy POS",
      },
      education: [{ degree: "Doctor of Pharmacy (Pharm-D)", school: "Margalla College of Pharmacy", date: "2014 – 2019" }],
      certificates: [
        { name: "Pharmacist licence", issuer: "Ministry of Public Health, Qatar", year: "2022" },
        { name: "Pharmacist registration", issuer: "Pharmacy Council of Pakistan", year: "2019" },
      ],
      languages: [
        ["English", "Fluent"],
        ["Urdu", "Native"],
        ["Arabic", "Basic"],
      ],
      details: { nationality: "Pakistani", visaStatus: "Qatar residence permit" },
      settings: { region: "gulf" },
    }),
    tips: [
      { title: "Show your licences and where they're valid", text: "List each registration (PCP, MOPH, DHA, SCFHS) with the year. Gulf recruiters filter on these first." },
      { title: "Count your clinical interventions", text: "Prescriptions reviewed and interventions accepted show your clinical value in a way a job title can't." },
      { title: "Prove you run a tidy pharmacy", text: "Stock accuracy, expiry write-offs and inspection results matter for retail and hospital roles alike." },
      { title: "Separate hospital and retail skills", text: "If you've done both, group the skills so a hospital recruiter sees clinical review and a retail one sees stock and sales." },
    ],
    skills: ["Prescription review", "Drug interactions", "Patient counselling", "Dispensing accuracy", "Inventory management", "Controlled drugs", "Pharmacovigilance", "Clinical guidelines", "Pharmacy software", "Regulatory compliance"],
    sampleSummary: {
      label: "For a fresh Pharm-D graduate",
      text: "Pharm-D graduate with hospital and community pharmacy placements. Accurate with dispensing, confident counselling patients in English and Urdu, and registered with the Pharmacy Council of Pakistan.",
    },
    faqs: [
      { q: "Should a pharmacist list sales targets?", a: "In retail roles, yes, if you had them: for example, growth in OTC sales. In hospital roles, focus on clinical work and safety." },
      { q: "Is a Pharm-D CV different from a B.Pharm one?", a: "The format is the same. Pharm-D graduates should make more of clinical rotations and prescription review." },
    ],
  },
];
