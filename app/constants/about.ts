// Content for the About screen.
//
// ── EDIT THIS FILE, not about.tsx ──
// The CREATOR block is the only part with placeholders. Replace every TODO.
// Everything below it describes the tool itself and is already accurate.

export type AboutLink = { label: string; url: string };

export const CREATOR = {
  // TODO: your name as you want it shown
  name: 'Wonjun Choi',
  // TODO: e.g. a school, team, or email address
  affiliation: 'wchoi2027@gmail.com',
  // TODO: naming the organization you built this for makes the story concrete —
  // "a 40-person swim club", "a student newspaper" — if you are comfortable doing so.
  bio:
    'I am a high school senior, and I am interested in organizational psychology. I want to know ' +
    'how power really works inside a group, and why the people in that group so often read it wrong. ' +
    'This project started with a real organization that I was part of. On paper, the formal chart ' +
    'told me who was in charge. In practice, it explained almost nothing about who actually made the ' +
    'decisions. I built this app to understand that gap.',
  // TODO: delete any you don't want; the section hides itself if the list is empty
  links: [
    { label: 'Email', url: 'mailto:wchoi2027@gmail.com' },
    { label: 'GitHub', url: 'https://github.com/wchoidevelop/power-trace' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/TODO' },
  ] as AboutLink[],
};

export type AboutSection = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  tone: string;
  points?: { label: string; text: string; badge?: string }[];
};

export const SECTIONS: AboutSection[] = [
  {
    key: 'why',
    eyebrow: 'THE MOTIVATION',
    title: 'Why this exists',
    tone: '#6366f1',
    body:
      'People often explain conflict in an organization as a personality problem. Seventy years of ' +
      'organizational psychology research show that the cause is usually structural. The important ' +
      'question is which role holds which kind of power, and which roles depend on other roles. ' +
      'This research has strong evidence, but it stays in academic journals, far from the person who ' +
      'must decide what to do. This app applies the research to a specific organization. It started ' +
      'with one real organization and now works for any organization.',
    points: [
      { label: 'The gap is application', text: 'The research exists. The problem is that nobody applies it to your specific situation.' },
      { label: 'Structure over character', text: 'The app asks what a role controls, not what kind of person holds the role.' },
      { label: 'Built from a real case', text: 'The app started with an organization where the formal chart explained almost nothing about who made decisions.' },
    ],
  },
  {
    key: 'project',
    eyebrow: 'THE PROJECT',
    title: 'What this does',
    tone: '#6366f1',
    body:
      'You describe your organization in plain language. The app makes a power map that shows which ' +
      'role holds which kind of power. It audits the power map for bias, because you wrote all of the ' +
      'input. Then it reads your situation against the finished power map.',
    points: [
      { label: 'Scores roles, not people', text: 'The app scores each role on what the role actually controls, not on what its title implies.' },
      { label: 'Audits your framing', text: 'You wrote every input, so the app checks the power map for bias before it uses it.' },
      { label: 'Shows its sources', text: 'Each score has a label: stated in your description, implied by your description, or assumed from the type of role.' },
    ],
  },
  {
    key: 'scope',
    eyebrow: 'THE SCOPE',
    title: 'Any organization, paid or not',
    tone: '#0ea5e9',
    body:
      'French and Raven describe social power, not employment. The same six bases of power operate in ' +
      'a company, a school club, a church, a volunteer board, or an online forum with moderators. The ' +
      'app works for all of these organizations.',
    points: [
      { label: 'Commercial', text: 'For companies, teams, and departments, the app runs every stage. This includes live labor-market data.' },
      { label: 'Non-commercial', text: 'For clubs, congregations, volunteer groups, and online communities, federal wage data does not apply. The app skips that stage and does not invent substitute data.' },
      { label: 'Why unpaid differs', text: 'An unpaid role has no salary to give and no job to threaten. Reward and coercive power become smaller. Influence moves to expertise, relationships, and information.' },
      { label: 'What leaving costs', text: 'In a job, the cost of leaving is economic. In a volunteer group, the cost is social. The analysis states which type of cost applies.' },
    ],
  },
  {
    key: 'framework',
    eyebrow: 'THE FRAMEWORK',
    title: 'Six bases of power',
    tone: '#8b5cf6',
    body:
      'Power is not one quantity. The six bases make an organizational chart easier to read. A person ' +
      'with no title who controls what leadership hears is not powerless.',
  },
  {
    key: 'concepts',
    eyebrow: 'THE RESEARCH',
    title: 'Concepts it reasons with',
    tone: '#8b5cf6',
    body:
      'The analysis uses only a fixed list of established research findings. A reference table in the ' +
      'code supplies each citation. The model does not write citations, because a model that writes ' +
      'citations will eventually invent one.',
    points: [
      {
        label: 'Bases of social power',
        text: 'French & Raven (1959), Raven (2004). This is the scoring model. The app scores six independent bases on what a role could do, not on what it did.',
      },
      {
        label: 'Soft and harsh influence',
        text: 'Raven, Schwarzwald & Koslowsky (1998). Harsh bases get compliance but lower job satisfaction. The power map shows which kind of power a role uses.',
      },
      {
        label: 'Exit, Voice, Loyalty, Neglect',
        text: 'Hirschman (1970), Rusbult (1988). These are four responses to dissatisfaction. The app predicts which response your role makes most likely. Then it recommends a better option.',
      },
      {
        label: 'Psychological safety',
        text: 'Edmondson (1999). This is whether people can raise a problem without punishment. It usually decides whether people speak or stay silent.',
      },
      {
        label: 'Equity and justice',
        text: 'Adams (1965), Greenberg (1987). These describe whether people see outcomes as fair, and whether they see the process behind the outcomes as fair.',
      },
      {
        label: 'Attribution and identity',
        text: 'Ross (1977), Tajfel & Turner (1979). These explain why people blame an opponent\'s character instead of the situation. They also explain how groups divide into "us" and "them."',
      },
      {
        label: 'Situational pressure',
        text: 'Milgram (1963), Asch (1951), Darley & Latané (1968), Janis (1972). These cover obedience, conformity, diffusion of responsibility, and groupthink. Together they explain why bystanders stay quiet.',
      },
      {
        label: 'Interpersonal harm',
        text: 'Tepper (2000), Cortina et al. (2001). These cover abusive supervision and workplace incivility. They give names to small, repeated harms that people find difficult to describe.',
      },
      {
        label: 'Distance and dissonance',
        text: 'Hofstede (1980), Festinger (1957), Goffman (1959). Hofstede explains how much hierarchy people accept as normal. Festinger explains how people justify that acceptance. Goffman explains how people control the impression they make on others.',
      },
    ],
  },
  {
    key: 'method',
    eyebrow: 'THE METHOD',
    title: 'Built in stages',
    tone: '#06b6d4',
    body: 'Each stage reduces the uncertainty that the previous stage left. The app audits the power map before it uses it.',
    points: [
      { badge: '1', label: 'Describe', text: 'Describe your organization, its roles, your role, and whether the work is paid.' },
      { badge: '2', label: 'Score', text: 'The app scores six bases for each role. It labels each score as stated, implied, or assumed.' },
      { badge: '3', label: 'Clarify', text: 'The app asks questions only about assumed scores that an answer can change.' },
      { badge: '4', label: 'Audit', text: 'Your answers change the scores. Then a bias audit corrects for your point of view.' },
      { badge: '5', label: 'Labor', text: 'The app gets live BLS data for your industry and sector. It skips this stage for unpaid organizations.' },
      { badge: '6', label: 'Diagnose', text: 'The app reads your situation against the finished power map.' },
    ],
  },
  {
    key: 'data',
    eyebrow: 'THE DATA',
    title: 'Where the numbers come from',
    tone: '#10b981',
    body:
      'For paid roles, the app gets live labor-market data from the U.S. Bureau of Labor Statistics (BLS). ' +
      'These BLS programs measure employment. They have no data for unpaid roles, so the app skips this ' +
      'stage for those roles.',
    points: [
      { label: 'CPS', text: 'Median weekly earnings by sex, union coverage, and union pay compared to nonunion pay.' },
      { label: 'JOLTS', text: 'Quits, layoffs, hires, and job openings. The app compares each rate to its own 19-year history and never shows a rate alone.' },
      { label: 'Market state', text: 'The app reads hiring and separations together. Low hiring with low layoffs is a frozen market. A frozen market is a different trap from a contracting market.' },
    ],
  },
  {
    key: 'limits',
    eyebrow: 'HONEST LIMITS',
    title: 'What it cannot tell you',
    tone: '#f59e0b',
    body: 'Each output depends on choices that a reasonable person could disagree with.',
    points: [
      { label: 'Constructed index', text: 'The worker power index is a composite that this app calculates. It is not a BLS statistic. It combines quits (50%), job openings (30%), and layoffs (minus 20%). A score of 50 equals the pre-COVID normal.' },
      { label: 'Chosen baseline', text: 'The app treats 2015–2019 as "normal" because it was the last period before COVID-19. This choice is reasonable, but it is still a choice.' },
      { label: 'Model judgments', text: 'The model infers power scores from your text. It cannot recover details that you did not include.' },
      { label: 'Coarse sector data', text: 'JOLTS has no data by occupation. The vacancies-per-unemployed ratio is a national number, not a sector number.' },
      { label: 'Findings, not laws', text: 'These concepts describe patterns across many organizations. Your organization can be an exception, and the analysis cannot tell when it is.' },
      { label: 'Bias flags are guesses', text: 'Each bias flag is a hypothesis about how you wrote something. The app shows each flag with the argument against it. Neither side is a final judgment.' },
      { label: 'Not advice', text: 'The analysis gives a structured reading. It is not legal, HR, or employment advice.' },
    ],
  },
];
