/**
 * Portfolio Context Data
 * This data is used by the AI chatbot to answer questions about Bikesh Rana
 * Update this file with your real information to personalize the chatbot responses
 */

export const portfolioContext = {
  personal: {
    name: 'Bikesh Rana',
    title: 'Full-Stack AI Engineer',
    location: 'Your Location', // TODO: Add your location
    email: 'bksh.rana@gmail.com',
    github: 'https://github.com/BikeshR',
    linkedin: 'https://www.linkedin.com/in/bikesh-rana',
    website: 'https://www.bikesh.dev',
    summary:
      'A passionate full-stack developer with expertise in AI/ML engineering, building modern web applications with Next.js, React, and cutting-edge AI technologies.', // TODO: Customize your summary
  },

  experience: [
    {
      company: 'Your Company', // TODO: Add your experience
      role: 'Your Role',
      duration: 'Jan 2024 - Present',
      location: 'Location',
      highlights: [
        'Built and deployed production AI applications',
        'Led full-stack development using Next.js, TypeScript, and Python',
        'Implemented AI/ML solutions using LangChain and OpenAI',
      ],
    },
    // Add more experience entries as needed
  ],

  projects: [
    {
      name: 'Portfolio Platform',
      slug: 'portfolio-platform',
      description:
        'A modern, modular portfolio platform with public showcase and private admin area. Features AI-powered chatbot for interactive engagement.',
      techStack: [
        'Next.js 15',
        'React 19',
        'TypeScript',
        'Supabase',
        'Tailwind CSS',
        'Groq AI',
        'shadcn/ui',
      ],
      url: 'https://www.bikesh.dev',
      github: 'https://github.com/BikeshR/menorepo/tree/main/portfolio-platform',
      highlights: [
        'Built with Next.js 15 App Router and React Server Components',
        'Integrated Groq AI (Llama 3.3 70B) for real-time chat interactions',
        'Implemented authentication with iron-session',
        'Deployed on Vercel with CI/CD pipeline',
        'Modular architecture for easy extensibility',
      ],
      status: 'live',
    },
    // TODO: Add your other projects here
    // {
    //   name: 'Project Name',
    //   slug: 'project-slug',
    //   description: 'Brief description',
    //   techStack: ['Tech1', 'Tech2'],
    //   url: 'https://...',
    //   github: 'https://github.com/...',
    //   highlights: ['Achievement 1', 'Achievement 2'],
    //   status: 'live' | 'in-progress' | 'archived'
    // },
  ],

  skills: {
    languages: [
      'TypeScript',
      'JavaScript',
      'Python',
      'SQL',
      // TODO: Add your programming languages
    ],
    frontend: [
      'React',
      'Next.js',
      'Tailwind CSS',
      'shadcn/ui',
      'HTML/CSS',
      // TODO: Add your frontend skills
    ],
    backend: [
      'Node.js',
      'Next.js API Routes',
      'Server Actions',
      'PostgreSQL',
      'Supabase',
      // TODO: Add your backend skills
    ],
    aiMl: [
      'Groq',
      'OpenAI',
      'LangChain',
      'Prompt Engineering',
      'RAG Systems',
      // TODO: Add your AI/ML skills
    ],
    cloud: [
      'Vercel',
      'Supabase',
      'GitHub Actions',
      'Docker',
      // TODO: Add your cloud/DevOps skills
    ],
    tools: [
      'Git',
      'VS Code',
      'Biome',
      'npm/pnpm',
      // TODO: Add your development tools
    ],
  },

  education: [
    {
      institution: 'Your University', // TODO: Add your education
      degree: 'Your Degree',
      field: 'Your Field',
      duration: '2020 - 2024',
      highlights: [
        // Add notable achievements, GPA, honors, etc.
      ],
    },
    // Add more education entries as needed
  ],

  interests: [
    'AI/ML Engineering',
    'Full-Stack Development',
    'Open Source',
    'System Architecture',
    // TODO: Add your professional interests
  ],

  availability: {
    status: 'open', // 'open' | 'selective' | 'not-looking'
    lookingFor: [
      'Full-time positions',
      'Contract work',
      'Interesting projects',
      // TODO: Customize what you're looking for
    ],
    preferredRoles: [
      'Full-Stack Engineer',
      'AI/ML Engineer',
      'Software Engineer',
      // TODO: Add your preferred roles
    ],
  },

  conversationGuidelines: {
    tone: 'professional yet friendly',
    style: 'concise and informative',
    maxLength: '2-3 paragraphs',
    suggestions: {
      experience: 'Ask me about my professional experience and recent projects',
      projects: "Learn about the interesting projects I've built",
      skills: 'Discover my technical skills and expertise',
      availability: "Find out if I'm available for new opportunities",
      contact: 'Get in touch with me directly',
    },
  },
}

export type PortfolioContext = typeof portfolioContext
