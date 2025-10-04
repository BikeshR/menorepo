import { Github, Linkedin, Mail, Twitter } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const contactMethods = [
  {
    icon: Mail,
    title: 'Email',
    description: 'Send me an email',
    value: 'hello@example.com',
    href: 'mailto:hello@example.com',
  },
  {
    icon: Github,
    title: 'GitHub',
    description: 'Check out my code',
    value: '@yourusername',
    href: 'https://github.com/yourusername',
  },
  {
    icon: Linkedin,
    title: 'LinkedIn',
    description: 'Connect professionally',
    value: 'Your Name',
    href: 'https://linkedin.com/in/yourprofile',
  },
  {
    icon: Twitter,
    title: 'Twitter',
    description: 'Follow me on Twitter',
    value: '@yourusername',
    href: 'https://twitter.com/yourusername',
  },
]

export default function ContactPage() {
  return (
    <div className="container py-12 md:py-16 max-w-4xl">
      {/* Page Header */}
      <div className="space-y-4 mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold">Get in Touch</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Feel free to reach out for collaborations, opportunities, or just to say hello. I&apos;m
          always happy to connect with fellow developers and tech enthusiasts.
        </p>
      </div>

      {/* Contact Methods Grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-12">
        {contactMethods.map((method) => {
          const Icon = method.icon
          return (
            <Link
              key={method.title}
              href={method.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="group-hover:text-primary transition-colors">
                        {method.title}
                      </CardTitle>
                      <CardDescription>{method.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{method.value}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle>Response Time</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">
            I typically respond to emails and messages within 24-48 hours. For urgent matters,
            please mention it in the subject line.
          </p>
          <p className="text-muted-foreground">Looking forward to hearing from you!</p>
        </CardContent>
      </Card>
    </div>
  )
}
