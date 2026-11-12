/**
 * Seeds mock job listings and a demo account whose applications match the dashboard mockup
 * (12 tracked: 5 In Progress, 4 Interview, 3 Offer, plus a few Saved).
 *
 * Idempotent: jobs use deterministic IDs and are upserted; the demo user is upserted by email
 * and their applications are rebuilt from scratch in one transaction. Dates are relative to
 * "now", so re-running refreshes them (upcoming interviews stay upcoming).
 *
 * Company names are real employers, but every listing is fictional mock data.
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import { ApplicationStatus, InterviewType, JobType } from '../src/generated/prisma/enums.js';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';

export const DEMO_EMAIL = 'demo@example.com';
export const DEMO_NAME = 'Cayden Willey';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stable UUID derived from a key, so the same job gets the same id on every run. */
function seedId(key: string): string {
  const h = createHash('sha256').update(`job-tracker-seed:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const today = new Date();

/** A UTC timestamp `days` from today (negative = past) at the given UTC hour. */
function dayAt(days: number, hourUtc: number): Date {
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days, hourUtc),
  );
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

interface JobSeed {
  key: string;
  title: string;
  company: string;
  location: string;
  jobType: JobType;
  postedDaysAgo: number;
  description: string;
}

const { INTERNSHIP, PART_TIME, FULL_TIME_ENTRY } = JobType;

const jobs: JobSeed[] = [
  // Internships
  {
    key: 'blackbaud-swe-intern',
    title: 'Software Engineering Intern',
    company: 'Blackbaud',
    location: 'Charleston, SC',
    jobType: INTERNSHIP,
    postedDaysAgo: 34,
    description:
      'Join a product team building cloud software for nonprofits. You will ship features in C# and TypeScript, write unit tests, and present a project to engineering leadership at the end of the summer.',
  },
  {
    key: 'bmw-it-intern',
    title: 'Information Technology Intern',
    company: 'BMW Manufacturing',
    location: 'Greer, SC',
    jobType: INTERNSHIP,
    postedDaysAgo: 21,
    description:
      'Support plant IT systems at the Spartanburg plant. Tasks include automating reports, maintaining shop-floor devices, and helping roll out new network equipment. Pursuing a degree in IT, CS, or a related field.',
  },
  {
    key: 'michelin-data-intern',
    title: 'Data Analytics Intern',
    company: 'Michelin North America',
    location: 'Greenville, SC',
    jobType: INTERNSHIP,
    postedDaysAgo: 30,
    description:
      'Work with the supply chain analytics team to clean data, build Power BI dashboards, and identify trends in distribution performance. SQL and Excel experience preferred; Python is a plus.',
  },
  {
    key: 'boeing-ops-intern',
    title: 'Operations Intern',
    company: 'Boeing South Carolina',
    location: 'North Charleston, SC',
    jobType: INTERNSHIP,
    postedDaysAgo: 45,
    description:
      'Partner with 787 production leaders to track build progress, improve work instructions, and support lean initiatives on the factory floor. Open to business, industrial engineering, and supply chain majors.',
  },
  {
    key: 'bcbssc-cyber-intern',
    title: 'Cybersecurity Intern',
    company: 'BlueCross BlueShield of South Carolina',
    location: 'Columbia, SC',
    jobType: INTERNSHIP,
    postedDaysAgo: 12,
    description:
      'Assist the security operations center with alert triage, vulnerability scanning, and phishing simulations. Coursework in networking or security required; Security+ is a plus.',
  },
  {
    key: 'scansource-marketing-intern',
    title: 'Marketing Intern',
    company: 'ScanSource',
    location: 'Greenville, SC',
    jobType: INTERNSHIP,
    postedDaysAgo: 26,
    description:
      'Help plan email campaigns, write social posts, and report on campaign metrics for a technology distributor. Strong writing skills and familiarity with Canva or Adobe Express preferred.',
  },
  {
    key: 'dominion-eng-intern',
    title: 'Engineering Intern',
    company: 'Dominion Energy South Carolina',
    location: 'Cayce, SC',
    jobType: INTERNSHIP,
    postedDaysAgo: 18,
    description:
      'Support distribution engineers with load studies, mapping updates, and field visits. Electrical engineering students entering their junior or senior year preferred.',
  },
  {
    key: 'sonoco-finance-intern',
    title: 'Finance Intern',
    company: 'Sonoco',
    location: 'Hartsville, SC',
    jobType: INTERNSHIP,
    postedDaysAgo: 15,
    description:
      'Assist the FP&A team with monthly close, variance analysis, and forecasting models. Finance or accounting majors with strong Excel skills are encouraged to apply.',
  },
  {
    key: 'ibm-swe-intern',
    title: 'Software Developer Intern',
    company: 'IBM',
    location: 'Remote (US)',
    jobType: INTERNSHIP,
    postedDaysAgo: 40,
    description:
      'Contribute to a hybrid cloud product team writing Go and Python services. You will participate in agile ceremonies, code reviews, and an intern hackathon.',
  },
  {
    key: 'salesforce-ux-intern',
    title: 'UX Design Intern',
    company: 'Salesforce',
    location: 'Remote (US)',
    jobType: INTERNSHIP,
    postedDaysAgo: 9,
    description:
      'Design and test user flows with a product squad. You will run usability sessions, build Figma prototypes, and present research findings. Portfolio required.',
  },
  {
    key: 'amazon-sde-intern',
    title: 'Software Development Engineer Intern',
    company: 'Amazon',
    location: 'Seattle, WA',
    jobType: INTERNSHIP,
    postedDaysAgo: 28,
    description:
      'Own a scoped project end to end on a team building customer-facing services. Proficiency in at least one of Java, C++, or Python and a solid grasp of data structures required.',
  },
  {
    key: 'deloitte-tech-intern',
    title: 'Technology Consulting Intern',
    company: 'Deloitte',
    location: 'Remote (US)',
    jobType: INTERNSHIP,
    postedDaysAgo: 20,
    description:
      'Work alongside consultants on a client engagement, helping gather requirements, document processes, and test system implementations. Strong communication skills required.',
  },

  // Part-time
  {
    key: 'target-retail-sales',
    title: 'Retail Sales Associate',
    company: 'Target',
    location: 'Columbia, SC',
    jobType: PART_TIME,
    postedDaysAgo: 22,
    description:
      'Help guests find what they need, run the register, and keep the sales floor stocked. Flexible evening and weekend shifts that work around class schedules.',
  },
  {
    key: 'bestbuy-geek-squad',
    title: 'Geek Squad Consultation Agent',
    company: 'Best Buy',
    location: 'Greenville, SC',
    jobType: PART_TIME,
    postedDaysAgo: 14,
    description:
      'Diagnose and repair computers, phones, and tablets at the service counter, and explain fixes to customers in plain language. Comfort with Windows and macOS troubleshooting required.',
  },
  {
    key: 'usc-student-it',
    title: 'Student IT Assistant',
    company: 'University of South Carolina',
    location: 'Columbia, SC',
    jobType: PART_TIME,
    postedDaysAgo: 38,
    description:
      'Staff the campus help desk, reset accounts, and set up classroom technology for faculty. 10–15 hours per week; current USC students only.',
  },
  {
    key: 'clemson-library-assistant',
    title: 'Library Student Assistant',
    company: 'Clemson University',
    location: 'Clemson, SC',
    jobType: PART_TIME,
    postedDaysAgo: 11,
    description:
      'Check materials in and out, help patrons find resources, and shelve returns at Cooper Library. Evening and weekend availability preferred.',
  },
  {
    key: 'publix-customer-service',
    title: 'Customer Service Staff',
    company: 'Publix',
    location: 'Mount Pleasant, SC',
    jobType: PART_TIME,
    postedDaysAgo: 7,
    description:
      'Greet customers, process transactions, and assist with returns and lottery sales at the service counter. No experience necessary; paid training provided.',
  },
  {
    key: 'starbucks-barista',
    title: 'Barista',
    company: 'Starbucks',
    location: 'Charleston, SC',
    jobType: PART_TIME,
    postedDaysAgo: 5,
    description:
      'Craft beverages, keep the café clean, and create a welcoming experience for customers. Benefits include tuition coverage through the ASU Online program.',
  },
  {
    key: 'founders-teller',
    title: 'Part-Time Teller',
    company: 'Founders Federal Credit Union',
    location: 'Lancaster, SC',
    jobType: PART_TIME,
    postedDaysAgo: 19,
    description:
      'Process deposits, withdrawals, and loan payments while helping members with account questions. Cash handling experience preferred; Saturday mornings required.',
  },
  {
    key: 'verizon-retail-consultant',
    title: 'Part-Time Retail Sales Consultant',
    company: 'Verizon',
    location: 'Myrtle Beach, SC',
    jobType: PART_TIME,
    postedDaysAgo: 16,
    description:
      'Help customers choose devices and plans, set up new phones, and troubleshoot accounts. Hourly pay plus commission.',
  },
  {
    key: 'riverbanks-guest-services',
    title: 'Guest Services Associate',
    company: 'Riverbanks Zoo and Garden',
    location: 'Columbia, SC',
    jobType: PART_TIME,
    postedDaysAgo: 24,
    description:
      'Sell admission and memberships, answer visitor questions, and support special events like Lights Before Christmas. Weekend availability required.',
  },
  {
    key: 'musc-patient-transporter',
    title: 'Patient Transporter',
    company: 'MUSC Health',
    location: 'Charleston, SC',
    jobType: PART_TIME,
    postedDaysAgo: 10,
    description:
      'Safely move patients between units, imaging, and procedures across the medical center. A great entry point for pre-health students; BLS certification provided.',
  },
  {
    key: 'ups-package-handler',
    title: 'Part-Time Package Handler',
    company: 'UPS',
    location: 'West Columbia, SC',
    jobType: PART_TIME,
    postedDaysAgo: 3,
    description:
      'Load, unload, and sort packages during early-morning or twilight shifts of 3–5 hours. Eligible for UPS Earn and Learn tuition assistance.',
  },
  {
    key: 'midlands-peer-tutor',
    title: 'Peer Tutor (Math and Computer Science)',
    company: 'Midlands Technical College',
    location: 'Columbia, SC',
    jobType: PART_TIME,
    postedDaysAgo: 27,
    description:
      'Tutor students one-on-one and in small groups in college algebra, statistics, and intro programming. Must have earned a B or higher in the courses you tutor.',
  },

  // Entry-level full-time
  {
    key: 'prisma-it-support',
    title: 'IT Support Specialist',
    company: 'Prisma Health',
    location: 'Greenville, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 33,
    description:
      'Provide tier 1 and tier 2 support for clinical and office staff, image and deploy workstations, and manage tickets in ServiceNow. CompTIA A+ or equivalent experience preferred.',
  },
  {
    key: 'benefitfocus-web-dev',
    title: 'Web Developer',
    company: 'Benefitfocus',
    location: 'Charleston, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 50,
    description:
      'Build and maintain responsive web pages for a benefits enrollment platform using React, TypeScript, and REST APIs. You will work with designers to meet WCAG accessibility standards.',
  },
  {
    key: 'zendesk-customer-support',
    title: 'Customer Support Associate',
    company: 'Zendesk',
    location: 'Remote (US)',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 25,
    description:
      'Answer customer questions over chat and email, document solutions in the knowledge base, and escalate bugs to engineering. Clear writing and patience with frustrated customers are a must.',
  },
  {
    key: 'lexington-help-desk',
    title: 'Help Desk Technician',
    company: 'Lexington Medical Center',
    location: 'West Columbia, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 29,
    description:
      'Resolve hardware, software, and account issues by phone and in person for hospital staff. Rotating shifts including some weekends.',
  },
  {
    key: 'phishlabs-qa-analyst',
    title: 'Junior QA Analyst',
    company: 'PhishLabs',
    location: 'Charleston, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 17,
    description:
      'Write and run manual and automated test cases for a threat intelligence platform. Exposure to Selenium or Playwright is a plus.',
  },
  {
    key: 'bcbssc-data-analyst',
    title: 'Associate Data Analyst',
    company: 'BlueCross BlueShield of South Carolina',
    location: 'Columbia, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 23,
    description:
      'Query claims data with SQL, build recurring reports, and help business partners interpret results. Recent graduates in statistics, math, or information systems encouraged to apply.',
  },
  {
    key: 'enterprise-mgmt-trainee',
    title: 'Management Trainee',
    company: 'Enterprise Mobility',
    location: 'Greenville, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 13,
    description:
      'Learn every part of running a rental branch, from customer service to sales and fleet management, with a path to branch manager. Bachelor’s degree required.',
  },
  {
    key: 'capitalone-associate-swe',
    title: 'Associate Software Engineer',
    company: 'Capital One',
    location: 'Remote (US)',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 8,
    description:
      'Build and operate cloud-native services on AWS in a team that practices test-driven development and continuous delivery. Bachelor’s in CS or related field, graduating within the last year.',
  },
  {
    key: 'accenture-tech-analyst',
    title: 'Technology Analyst',
    company: 'Accenture',
    location: 'Remote (US)',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 31,
    description:
      'Join a client delivery team configuring enterprise platforms, writing test scripts, and supporting go-live. Includes a paid onboarding bootcamp.',
  },
  {
    key: 'santee-cooper-it-analyst',
    title: 'IT Analyst I',
    company: 'Santee Cooper',
    location: 'Moncks Corner, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 6,
    description:
      'Support business applications for a state-owned utility: gather requirements, test releases, and train end users. Familiarity with SQL and scripting preferred.',
  },
  {
    key: 'duke-energy-business-analyst',
    title: 'Associate Business Analyst',
    company: 'Duke Energy',
    location: 'Greenville, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 20,
    description:
      'Map current processes, document requirements, and help deliver system improvements for customer operations. Strong Excel and communication skills required.',
  },
  {
    key: 'aws-cloud-support',
    title: 'Cloud Support Associate',
    company: 'Amazon Web Services',
    location: 'Dallas, TX',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 4,
    description:
      'Troubleshoot customer issues across Linux, networking, and core AWS services, with a structured training program in your first months. Relocation assistance available.',
  },
  {
    key: 'kyocera-avx-technician',
    title: 'Manufacturing Technician',
    company: 'KYOCERA AVX',
    location: 'Fountain Inn, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 35,
    description:
      'Operate and maintain equipment that produces electronic components, monitor quality metrics, and support process improvements. Associate degree in a technical field preferred.',
  },
  {
    key: 'blue-acorn-frontend-dev',
    title: 'Junior Front-End Developer',
    company: 'Blue Acorn iCi',
    location: 'Charleston, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 12,
    description:
      'Build e-commerce storefront features with HTML, CSS, and JavaScript for retail clients. A portfolio of personal or class projects is required.',
  },
  {
    key: 'clemson-desktop-support',
    title: 'Desktop Support Technician',
    company: 'Clemson University',
    location: 'Clemson, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 19,
    description:
      'Set up, repair, and upgrade computers for faculty and staff across campus, and keep asset records up to date. Comes with state benefits and tuition assistance.',
  },
  {
    key: 'td-bank-ops-associate',
    title: 'Bank Operations Associate',
    company: 'TD Bank',
    location: 'Greenville, SC',
    jobType: FULL_TIME_ENTRY,
    postedDaysAgo: 2,
    description:
      'Process account maintenance requests, research transaction discrepancies, and keep operations compliant with bank policies. Detail-oriented recent graduates welcome.',
  },
];

// ---------------------------------------------------------------------------
// Demo user's applications
// ---------------------------------------------------------------------------

const { SAVED, APPLIED, IN_PROGRESS, INTERVIEW, OFFER } = ApplicationStatus;

interface ApplicationSeed {
  jobKey: string;
  status: ApplicationStatus;
  /** Days ago the application left SAVED (ignored for SAVED). */
  appliedDaysAgo?: number;
  /** Days ago the most recent status change happened (ignored for SAVED). */
  lastChangeDaysAgo?: number;
  /** Days ago a SAVED job was bookmarked. */
  savedDaysAgo?: number;
  /** If true, the job was saved a few days before applying; otherwise logged straight as APPLIED. */
  savedFirst?: boolean;
  notes?: string;
  interview?: { inDays: number; hourUtc: number; type: InterviewType; notes: string };
}

const applications: ApplicationSeed[] = [
  // In Progress (5)
  {
    jobKey: 'target-retail-sales',
    status: IN_PROGRESS,
    appliedDaysAgo: 18,
    lastChangeDaysAgo: 5,
    notes: 'Store manager said they would reach out after the background check clears.',
  },
  {
    jobKey: 'zendesk-customer-support',
    status: IN_PROGRESS,
    appliedDaysAgo: 20,
    lastChangeDaysAgo: 9,
    savedFirst: true,
    notes: 'Completed the written support scenario assessment.',
  },
  {
    jobKey: 'michelin-data-intern',
    status: IN_PROGRESS,
    appliedDaysAgo: 24,
    lastChangeDaysAgo: 3,
    savedFirst: true,
    notes: 'Recruiter screen went well. Waiting to hear about next steps.',
  },
  {
    jobKey: 'bcbssc-data-analyst',
    status: IN_PROGRESS,
    appliedDaysAgo: 15,
    lastChangeDaysAgo: 6,
    notes: 'Sent the SQL take-home on Monday.',
  },
  {
    jobKey: 'scansource-marketing-intern',
    status: IN_PROGRESS,
    appliedDaysAgo: 12,
    lastChangeDaysAgo: 2,
    savedFirst: true,
  },

  // Interview (4) — two have upcoming interviews scheduled
  {
    jobKey: 'blackbaud-swe-intern',
    status: INTERVIEW,
    appliedDaysAgo: 28,
    lastChangeDaysAgo: 4,
    savedFirst: true,
    notes: 'Referral from career fair. Review the take-home project before the technical round.',
    interview: {
      inDays: 3,
      hourUtc: 15,
      type: InterviewType.VIRTUAL,
      notes:
        'Technical interview with the platform team on Zoom: data structures and a code walkthrough.',
    },
  },
  {
    jobKey: 'prisma-it-support',
    status: INTERVIEW,
    appliedDaysAgo: 22,
    lastChangeDaysAgo: 7,
    notes: 'Bring printed resume and A+ study notes.',
    interview: {
      inDays: 6,
      hourUtc: 14,
      type: InterviewType.ONSITE,
      notes: 'Panel interview with the IT service desk manager at the Greenville Memorial campus.',
    },
  },
  {
    jobKey: 'lexington-help-desk',
    status: INTERVIEW,
    appliedDaysAgo: 19,
    lastChangeDaysAgo: 2,
    notes: 'Phone screen done. Waiting on them to schedule the second round.',
  },
  {
    jobKey: 'ibm-swe-intern',
    status: INTERVIEW,
    appliedDaysAgo: 32,
    lastChangeDaysAgo: 10,
    savedFirst: true,
  },

  // Offer (3)
  {
    jobKey: 'benefitfocus-web-dev',
    status: OFFER,
    appliedDaysAgo: 42,
    lastChangeDaysAgo: 2,
    savedFirst: true,
    notes: 'Offer letter received. Decision due by end of next week.',
  },
  {
    jobKey: 'usc-student-it',
    status: OFFER,
    appliedDaysAgo: 30,
    lastChangeDaysAgo: 8,
    notes: '12 hrs/week. Can start next semester.',
  },
  {
    jobKey: 'boeing-ops-intern',
    status: OFFER,
    appliedDaysAgo: 36,
    lastChangeDaysAgo: 5,
    notes: 'Summer internship offer. Need to confirm housing stipend details.',
  },

  // Saved (not counted on the dashboard)
  {
    jobKey: 'salesforce-ux-intern',
    status: SAVED,
    savedDaysAgo: 6,
    notes: 'Update portfolio before applying.',
  },
  { jobKey: 'aws-cloud-support', status: SAVED, savedDaysAgo: 2 },
  { jobKey: 'santee-cooper-it-analyst', status: SAVED, savedDaysAgo: 4 },
  {
    jobKey: 'capitalone-associate-swe',
    status: SAVED,
    savedDaysAgo: 1,
    notes: 'Ask Prof. Nguyen for a referral?',
  },
];

/** Statuses an application passes through after APPLIED to reach its current status. */
const progression: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  [APPLIED]: [],
  [IN_PROGRESS]: [IN_PROGRESS],
  [INTERVIEW]: [IN_PROGRESS, INTERVIEW],
  [OFFER]: [IN_PROGRESS, INTERVIEW, OFFER],
};

interface HistoryRow {
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedAt: Date;
}

function buildTimeline(app: ApplicationSeed): {
  createdAt: Date;
  dateApplied: Date | null;
  history: HistoryRow[];
} {
  if (app.status === SAVED) {
    const createdAt = dayAt(-(app.savedDaysAgo ?? 1), 16);
    return {
      createdAt,
      dateApplied: null,
      history: [{ fromStatus: null, toStatus: SAVED, changedAt: createdAt }],
    };
  }

  const steps = progression[app.status];
  const { appliedDaysAgo, lastChangeDaysAgo } = app;
  if (
    !steps ||
    appliedDaysAgo === undefined ||
    lastChangeDaysAgo === undefined ||
    appliedDaysAgo - lastChangeDaysAgo < steps.length
  ) {
    throw new Error(`Bad seed timeline for ${app.jobKey}`);
  }

  const dateApplied = dayAt(-appliedDaysAgo, 13);
  const history: HistoryRow[] = [];
  let createdAt = dateApplied;

  if (app.savedFirst) {
    createdAt = dayAt(-(appliedDaysAgo + 4), 19);
    history.push({ fromStatus: null, toStatus: SAVED, changedAt: createdAt });
    history.push({ fromStatus: SAVED, toStatus: APPLIED, changedAt: dateApplied });
  } else {
    history.push({ fromStatus: null, toStatus: APPLIED, changedAt: dateApplied });
  }

  // Spread later changes evenly between applying and the most recent change.
  const span = appliedDaysAgo - lastChangeDaysAgo;
  let from: ApplicationStatus = APPLIED;
  steps.forEach((to, i) => {
    const daysAfterApplying = Math.round((span * (i + 1)) / steps.length);
    history.push({
      fromStatus: from,
      toStatus: to,
      changedAt: dayAt(-appliedDaysAgo + daysAfterApplying, 17),
    });
    from = to;
  });

  return { createdAt, dateApplied, history };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Writes the seed data. Exported so tests can seed the test database. */
export async function seed(): Promise<void> {
  const demoPassword = z
    .string({ error: 'SEED_DEMO_PASSWORD is required (see .env.example)' })
    .min(8, 'SEED_DEMO_PASSWORD must be at least 8 characters')
    .parse(process.env.SEED_DEMO_PASSWORD);
  const passwordHash = await hashPassword(demoPassword);

  const jobIds = new Map(jobs.map((j) => [j.key, seedId(j.key)]));
  const jobPostedDaysAgo = new Map(jobs.map((j) => [j.key, j.postedDaysAgo]));

  await prisma.$transaction(
    async (tx) => {
      for (const { key, postedDaysAgo, ...fields } of jobs) {
        const data = {
          ...fields,
          url: `https://jobs.example.com/${key}`,
          postedAt: dayAt(-postedDaysAgo, 12),
        };
        await tx.job.upsert({
          where: { id: seedId(key) },
          create: { id: seedId(key), ...data },
          update: data,
        });
      }

      const user = await tx.user.upsert({
        where: { email: DEMO_EMAIL },
        create: { name: DEMO_NAME, email: DEMO_EMAIL, passwordHash },
        update: { name: DEMO_NAME, passwordHash },
      });

      // Cascades to StatusHistory and Interview.
      await tx.application.deleteMany({ where: { userId: user.id } });

      for (const app of applications) {
        const jobId = jobIds.get(app.jobKey);
        if (!jobId) throw new Error(`Unknown job key: ${app.jobKey}`);

        const { createdAt, dateApplied, history } = buildTimeline(app);
        if (createdAt < dayAt(-(jobPostedDaysAgo.get(app.jobKey) ?? 0), 12)) {
          throw new Error(`Seed application for ${app.jobKey} predates the job posting`);
        }
        const lastChange = history.at(-1)?.changedAt ?? createdAt;

        await tx.application.create({
          data: {
            userId: user.id,
            jobId,
            status: app.status,
            dateApplied,
            notes: app.notes ?? null,
            createdAt,
            updatedAt: lastChange,
            statusHistory: { create: history },
            ...(app.interview && {
              interviews: {
                create: {
                  scheduledAt: dayAt(app.interview.inDays, app.interview.hourUtc),
                  type: app.interview.type,
                  notes: app.interview.notes,
                },
              },
            }),
          },
        });
      }
    },
    { timeout: 30_000 },
  );
}

async function main(): Promise<void> {
  await seed();

  const counts = applications.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Seeded ${jobs.length} jobs and demo user ${DEMO_EMAIL}.`);
  console.log('Demo applications by status:', counts);
}

// Only run when executed directly (npm run db:seed), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
