import { ExternalLink, Github } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Dummy project data
const projects = [
  {
    id: 1,
    title: 'Portfolio Platform',
    description:
      'A full-stack portfolio platform with public project showcase and private admin tools. Built with Next.js 15, React 19, and Supabase.',
    techStack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Supabase'],
    githubUrl: 'https://github.com',
    liveUrl: 'https://example.com',
    detailUrl: '/projects/portfolio-platform',
    status: 'published',
  },
  {
    id: 2,
    title: 'E-Commerce Dashboard',
    description:
      'Modern e-commerce admin dashboard with real-time analytics, inventory management, and order processing.',
    techStack: ['React', 'Node.js', 'PostgreSQL', 'Chart.js'],
    githubUrl: 'https://github.com',
    liveUrl: null,
    status: 'published',
  },
  {
    id: 3,
    title: 'Task Management App',
    description:
      'Collaborative task management application with real-time updates, team collaboration, and project tracking.',
    techStack: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'WebSockets'],
    githubUrl: 'https://github.com',
    liveUrl: 'https://example.com',
    status: 'published',
  },
  {
    id: 4,
    title: 'Weather Dashboard',
    description:
      'Beautiful weather dashboard with forecasts, historical data, and interactive maps. Integrates with multiple weather APIs.',
    techStack: ['React', 'TypeScript', 'Tailwind CSS', 'OpenWeather API'],
    githubUrl: 'https://github.com',
    liveUrl: 'https://example.com',
    status: 'published',
  },
  {
    id: 5,
    title: 'Blog Platform',
    description:
      'Markdown-based blog platform with syntax highlighting, SEO optimization, and comment system.',
    techStack: ['Next.js', 'MDX', 'Tailwind CSS', 'Vercel'],
    githubUrl: 'https://github.com',
    liveUrl: null,
    status: 'published',
  },
  {
    id: 6,
    title: 'Chat Application',
    description:
      'Real-time chat application with private messages, group chats, and file sharing capabilities.',
    techStack: ['React', 'Socket.io', 'Node.js', 'MongoDB'],
    githubUrl: 'https://github.com',
    liveUrl: 'https://example.com',
    status: 'published',
  },
]

export default function ProjectsPage() {
  return (
    <div className="container py-12 md:py-16">
      {/* Page Header */}
      <div className="space-y-4 mb-12">
        <h1 className="text-4xl md:text-5xl font-bold">Projects</h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          A collection of projects showcasing various technologies and solutions. From web
          applications to developer tools, each project represents a unique challenge and learning
          experience.
        </p>
      </div>

      {/* Projects Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="flex flex-col h-full">
            <CardHeader>
              <CardTitle>{project.title}</CardTitle>
              <CardDescription>{project.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              {/* Tech Stack */}
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Tech Stack:</p>
                <div className="flex flex-wrap gap-2">
                  {project.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-2">
                {'detailUrl' in project && project.detailUrl && (
                  <Link href={project.detailUrl}>
                    <Button variant="default" size="sm" className="w-full">
                      View Details
                    </Button>
                  </Link>
                )}
                {project.githubUrl && (
                  <Link href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <Github className="h-4 w-4 mr-2" />
                      Code
                    </Button>
                  </Link>
                )}
                {project.liveUrl && (
                  <Link href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Live Demo
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
