import { Briefcase, Code2, GraduationCap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AboutPage() {
  return (
    <div className="container py-12 md:py-16 max-w-5xl">
      {/* Page Header */}
      <div className="space-y-4 mb-12">
        <h1 className="text-4xl md:text-5xl font-bold">About Me</h1>
        <p className="text-xl text-muted-foreground">
          Full-stack developer passionate about building modern web applications
        </p>
      </div>

      {/* Bio Section */}
      <section className="mb-12">
        <Card>
          <CardHeader>
            <CardTitle>Bio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Welcome to my portfolio platform! I&apos;m a software developer with a passion for
              creating elegant solutions to complex problems. This platform serves as both a
              showcase for my public projects and a hub for my private development tools.
            </p>
            <p className="text-muted-foreground">
              I specialize in full-stack web development using modern technologies like React,
              Next.js, TypeScript, and various backend frameworks. I believe in writing clean,
              maintainable code and building applications that provide real value to users.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Skills Section */}
      <section className="mb-12">
        <h2 className="text-3xl font-bold mb-6">Skills</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Code2 className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Frontend Development</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li>React & Next.js</li>
                <li>TypeScript</li>
                <li>Tailwind CSS</li>
                <li>Modern CSS & Responsive Design</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Code2 className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Backend Development</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li>Node.js & Express</li>
                <li>PostgreSQL & Supabase</li>
                <li>REST APIs & GraphQL</li>
                <li>Authentication & Authorization</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <GraduationCap className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Tools & Technologies</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li>Git & GitHub</li>
                <li>Docker & CI/CD</li>
                <li>Vercel & Cloud Platforms</li>
                <li>Testing & Debugging</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Briefcase className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Other Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li>UI/UX Design Principles</li>
                <li>System Architecture</li>
                <li>Performance Optimization</li>
                <li>Agile Development</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Experience Section */}
      <section className="mb-12">
        <h2 className="text-3xl font-bold mb-6">Experience</h2>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Full-Stack Developer</CardTitle>
              <CardDescription>Personal Projects & Freelance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-muted-foreground">
                Building modern web applications using Next.js, React, and TypeScript. Focused on
                creating scalable architectures and exceptional user experiences.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Developed portfolio platform with public and private sections</li>
                <li>Implemented authentication and authorization systems</li>
                <li>Created responsive, accessible user interfaces</li>
                <li>Integrated with various APIs and databases</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open Source Contributions</CardTitle>
              <CardDescription>Various Projects</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Contributing to open-source projects and maintaining personal repositories. Focused
                on improving developer tools and libraries used by the community.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
