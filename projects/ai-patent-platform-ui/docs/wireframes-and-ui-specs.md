# Wireframes & UI Design Specifications
## AI Patent Platform UI - Phase 2 Deliverable

**Document Version:** 1.0  
**Date:** December 19, 2024  
**Design Focus:** Detailed wireframe descriptions and UI specifications for implementation  

---

## Executive Summary

This document provides comprehensive wireframe descriptions and UI specifications for all core screens and user flows of the AI Patent Platform. These specifications serve as implementation guidelines for the component library and page development phases.

---

## 1. Design System Foundation

### Visual Design Language

#### **Color Palette**
```css
/* Primary Colors */
--primary-blue: #1E40AF;     /* Primary actions, links */
--primary-blue-light: #3B82F6; /* Hover states */
--primary-blue-dark: #1D4ED8;  /* Active states */

/* AI Confidence Colors */
--ai-high-confidence: #059669;   /* Green - 85-100% */
--ai-medium-confidence: #D97706; /* Amber - 65-84% */
--ai-low-confidence: #DC2626;    /* Red - <65% */
--ai-processing: #7C3AED;        /* Purple - Processing */

/* Patent Status Colors */
--status-pending: #2563EB;       /* Blue */
--status-granted: #059669;       /* Green */
--status-rejected: #DC2626;      /* Red */
--status-abandoned: #6B7280;     /* Gray */

/* Neutral Colors */
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-300: #D1D5DB;
--gray-400: #9CA3AF;
--gray-500: #6B7280;
--gray-600: #4B5563;
--gray-700: #374151;
--gray-800: #1F2937;
--gray-900: #111827;

/* Background Colors */
--bg-primary: #FFFFFF;
--bg-secondary: #F9FAFB;
--bg-tertiary: #F3F4F6;
--bg-accent: #EFF6FF;
```

#### **Typography Scale**
```css
/* Font Family */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Courier New', monospace;

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */

/* Line Heights */
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

#### **Spacing System**
```css
/* Spacing Scale (8px base) */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
--space-20: 5rem;    /* 80px */
--space-24: 6rem;    /* 96px */

/* Patent-Specific Spacing */
--document-margin: 2rem;
--claim-indent: 1.5rem;
--ai-panel-width: 24rem;
```

---

## 2. Core Screen Wireframes

### 2.1 Dashboard & Portfolio Overview

#### **Layout Structure**
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo | Search | Notifications | User Menu           │
├─────────────────────────────────────────────────────────────┤
│ Sidebar Navigation (240px)           │ Main Content Area   │
│ ├── Dashboard                        │                     │
│ ├── Inventions                       │ [Content varies by  │
│ ├── Patents                          │  selected section]  │
│ ├── Research                         │                     │
│ ├── Portfolio                        │                     │
│ └── Settings                         │                     │
└─────────────────────────────────────────────────────────────┘
```

#### **Dashboard Main Content**
```
┌─────────────────────────────────────────────────────────────┐
│ Page Header                                                 │
│ ┌─ "Portfolio Dashboard" (text-3xl, font-bold)             │
│ └─ Quick Actions: [New Invention] [AI Analysis] [Export]   │
├─────────────────────────────────────────────────────────────┤
│ Key Metrics Cards (Grid: 4 columns on desktop, 2 on tablet)│
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│ │ Active  │ │ Pending │ │ AI      │ │ Portfolio│           │
│ │ Patents │ │ Apps    │ │ Tasks   │ │ Health   │           │
│ │   47    │ │   12    │ │    3    │ │  87/100  │           │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
├─────────────────────────────────────────────────────────────┤
│ Main Content Grid (2 columns: 2fr 1fr)                     │
│ ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Recent Activity         │ │ AI Insights Panel           │ │
│ │ ├── Patent App #1234   │ │ ├── Portfolio Gaps          │ │
│ │ │   Status: Pending    │ │ │   "Consider filing in      │ │
│ │ │   AI: 92% confidence │ │ │    blockchain space"       │ │
│ │ ├── Invention #5678    │ │ ├── Priority Actions        │ │
│ │ │   Status: Reviewing  │ │ │   "3 deadlines approaching"│ │
│ │ ├── Prior Art Search   │ │ ├── Competitive Alerts      │ │
│ │ │   Status: Completed  │ │ │   "2 new competitor filings"│ │
│ └─────────────────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### **Component Specifications**

**Metric Cards:**
- **Size:** 200px × 120px minimum
- **Background:** white with subtle border (gray-200)
- **Content Structure:**
  - Number: text-3xl, font-bold, colored by metric type
  - Label: text-sm, text-gray-600
  - Optional change indicator: small up/down arrow with percentage

**Activity Feed Items:**
- **Height:** 60px each
- **Structure:** Icon (24×24) | Title | Subtitle | Timestamp | Status Badge
- **Hover State:** bg-gray-50 background
- **Click Action:** Navigate to relevant detail page

**AI Insights Panel:**
- **Background:** bg-blue-50 with blue-100 border
- **Header:** "AI Insights" with brain icon
- **Content:** List of insight cards with confidence indicators

### 2.2 Invention Harvesting Wizard

#### **Wizard Layout Structure**
```
┌─────────────────────────────────────────────────────────────┐
│ Wizard Header                                               │
│ ┌─ Progress Steps: ● ○ ○ ○                                 │
│ │   Basic | Technical | AI Analysis | Review              │
│ └─ Step 1 of 4: Basic Information                          │
├─────────────────────────────────────────────────────────────┤
│ Step Content Area (centered, max-width: 800px)            │
│                                                             │
│ [Step-specific content varies]                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Action Bar                                                  │
│ [Cancel] [Save Draft]              [Back] [Continue →]     │
└─────────────────────────────────────────────────────────────┘
```

#### **Step 1: Basic Information**
```
┌─────────────────────────────────────────────────────────────┐
│ Form Fields (single column, 600px max-width)               │
│                                                             │
│ Invention Title *                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Text input, placeholder: "Brief descriptive title"]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Primary Inventor *                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Name input with autocomplete from company directory]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Additional Inventors                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Multi-select with add/remove functionality]           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Technology Area *                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Dropdown: Software | Hardware | Biotech | Chemical]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Business Unit                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Dropdown populated from company structure]             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Priority Level                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ○ High  ○ Medium  ○ Low                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### **Step 2: Technical Details (with AI Assistance)**
```
┌─────────────────────────────────────────────────────────────┐
│ Main Content (2 columns: 2fr 1fr)                          │
│ ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Technical Description * │ │ AI Assistant Panel          │ │
│ │ ┌─────────────────────┐ │ │ ┌─────────────────────────┐ │ │
│ │ │ [Rich text editor   │ │ │ │ Status: Analyzing...    │ │ │
│ │ │  min-height: 200px  │ │ │ │ ┌─────────────────────┐ │ │ │
│ │ │  placeholder: "Des- │ │ │ │ │ [Progress bar]      │ │ │ │
│ │ │  cribe the technical│ │ │ │ └─────────────────────┘ │ │ │
│ │ │  solution..."]      │ │ │ │                         │ │ │
│ │ └─────────────────────┘ │ │ │ Suggestions:            │ │ │
│ │                         │ │ │ • Consider adding more  │ │ │
│ │ Problem Statement *     │ │ │   technical detail      │ │ │
│ │ ┌─────────────────────┐ │ │ │ • Clarify the algorithm │ │ │
│ │ │ [Textarea]          │ │ │ │   approach              │ │ │
│ │ └─────────────────────┘ │ │ │                         │ │ │
│ │                         │ │ │ Confidence: 73%         │ │ │
│ │ Technical Advantages *  │ │ │ [Accept] [Dismiss]      │ │ │
│ │ ┌─────────────────────┐ │ │ └─────────────────────────┘ │ │
│ │ │ [Textarea]          │ │ └─────────────────────────────┘ │
│ │ └─────────────────────┘ │                               │
│ │                         │                               │
│ │ Implementation Details  │                               │
│ │ ┌─────────────────────┐ │                               │
│ │ │ [Rich text editor]  │ │                               │
│ │ └─────────────────────┘ │                               │
│ └─────────────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

#### **Step 3: AI Analysis Results**
```
┌─────────────────────────────────────────────────────────────┐
│ Analysis Results Header                                     │
│ ┌─ "AI Analysis Complete" (text-2xl, font-semibold)        │
│ └─ Confidence Score: 87% (with colored indicator)          │
├─────────────────────────────────────────────────────────────┤
│ Results Grid (3 columns on desktop, 1 on mobile)          │
│ ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│ │ Patentability   │ │ Prior Art       │ │ Claim Scope   │ │
│ │ Assessment      │ │ Analysis        │ │ Suggestions   │ │
│ │                 │ │                 │ │               │ │
│ │ Score: 8.2/10   │ │ 3 relevant      │ │ Independent:  │ │
│ │ ├─ Novelty: 9/10│ │ patents found   │ │ 3-5 claims    │ │
│ │ ├─ Non-obvious- │ │                 │ │ Dependent:    │ │
│ │ │   ness: 7/10   │ │ Conflicts:      │ │ 10-15 claims  │ │
│ │ └─ Utility: 9/10│ │ Low risk        │ │               │ │
│ │                 │ │                 │ │ Focus areas:  │ │
│ │ Recommendation: │ │ [View Details]  │ │ • Algorithm   │ │
│ │ Proceed with    │ │                 │ │ • Data struct │ │
│ │ filing          │ │                 │ │ • UI method   │ │
│ └─────────────────┘ └─────────────────┘ └───────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ AI Reasoning (Expandable Section)                          │
│ ┌─ "Why we recommend proceeding" (expandable)              │
│ └─ • Strong technical merit and clear advantages           │
│    • Limited prior art conflicts identified                │
│    • Clear commercial potential                            │
│    • Suitable for multiple claim strategies                │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Patent Drafting Studio

#### **Studio Layout Structure**
```
┌─────────────────────────────────────────────────────────────┐
│ Studio Header                                               │
│ ┌─ Document Title: "AI-Powered Search Algorithm"           │
│ │   [Edit] [Share] [Export] [Save]                         │
│ └─ Status: Draft | Last saved: 2 minutes ago               │
├─────────────────────────────────────────────────────────────┤
│ Three-Panel Layout                                          │
│ ┌──────────┐ ┌────────────────────┐ ┌─────────────────────┐ │
│ │ Section  │ │ Main Editor        │ │ AI Assistant        │ │
│ │ Nav      │ │                    │ │ Panel               │ │
│ │ (200px)  │ │ (flexible)         │ │ (300px)             │ │
│ │          │ │                    │ │                     │ │
│ │ ● Abstract│ │ [Editor content    │ │ Current Task:       │ │
│ │ ○ Background│ │  varies by       │ │ Reviewing claims    │ │
│ │ ○ Summary │ │  selected         │ │                     │ │
│ │ ● Claims  │ │  section]         │ │ AI Suggestions:     │ │
│ │ ○ Description│ │                │ │ [Suggestion cards]  │ │
│ │ ○ Drawings│ │                   │ │                     │ │
│ │ ○ References│ │                 │ │ Confidence: 84%     │ │
│ └──────────┘ └────────────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### **Claims Editor (Main Panel)**
```
┌─────────────────────────────────────────────────────────────┐
│ Section Header                                              │
│ ┌─ "Claims" (text-xl, font-semibold)                       │
│ └─ [AI Generate] [Add Claim] [Import] [Validate]           │
├─────────────────────────────────────────────────────────────┤
│ Claims List (Rich Text Editor with Numbering)             │
│                                                             │
│ 1. A computer-implemented method for patent analysis,      │
│    comprising:                                              │
│    ┌─ highlighting potential improvements ─┐                │
│    │ (a) receiving user input describing an invention;     │ │
│    │ (b) analyzing the input using machine learning;       │ │
│    │ (c) generating patent claims based on the analysis;   │ │
│    └─ confidence: 89% ─────────────────────┘                │
│                                                             │
│ 2. The method of claim 1, wherein the machine learning     │
│    comprises:                                               │
│    (a) natural language processing of the user input;      │
│    (b) semantic analysis of technical concepts;            │
│                                                             │
│ [Add Dependent Claim] [Add Independent Claim]              │
├─────────────────────────────────────────────────────────────┤
│ Editor Tools                                                │
│ [B] [I] [U] | [Indent] [Outdent] | [Link] [Reference]     │
└─────────────────────────────────────────────────────────────┘
```

#### **AI Assistant Panel (Right Panel)**
```
┌─────────────────────────────────────────────────────────────┐
│ AI Status Header                                            │
│ ┌─ [AI Brain Icon] AI Assistant                            │
│ └─ Status: Active | Confidence: 84%                        │
├─────────────────────────────────────────────────────────────┤
│ Current Suggestions                                         │
│                                                             │
│ ┌─ Suggestion Card 1 ──────────────────────────────────────┐ │
│ │ Claim Improvement                           Confidence: 87%│ │
│ │ ─────────────────                           ○○○○○        │ │
│ │                                                           │ │
│ │ "Consider adding technical details about the algorithm    │ │
│ │ to strengthen claim 1(b)"                                 │ │
│ │                                                           │ │
│ │ Reasoning:                                                │ │
│ │ • Increases claim specificity                             │ │
│ │ • Reduces prior art conflicts                             │ │
│ │                                                           │ │
│ │ [Accept] [Modify] [Dismiss]                              │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Suggestion Card 2 ──────────────────────────────────────┐ │
│ │ Prior Art Alert                             Confidence: 76%│ │
│ │ ───────────────                             ○○○○○        │ │
│ │                                                           │ │
│ │ "Potential overlap with US Pat. 9,123,456 - review       │ │
│ │ recommended"                                              │ │
│ │                                                           │ │
│ │ [View Patent] [Analyze Conflict] [Dismiss]               │ │
│ └───────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Quick Actions                                               │
│ ┌─ [Generate Abstract] [Check Prior Art]                   │
│ └─ [Validate Claims] [Export Draft]                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Prior Art Search Interface

#### **Search Interface Layout**
```
┌─────────────────────────────────────────────────────────────┐
│ Search Header                                               │
│ ┌─ "Prior Art Research" (text-2xl, font-semibold)          │
│ └─ [New Search] [Search History] [Export Results]          │
├─────────────────────────────────────────────────────────────┤
│ Search Input Area                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Search Query (Rich Text Input)                          │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ [Describe your invention or paste patent claims...] │ │ │
│ │ │                                                     │ │ │
│ │ │ [Rich text editor with formatting tools]            │ │ │
│ │ │                                                     │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ Search Options (Collapsible)                           │ │
│ │ ○ Semantic Search  ○ Keyword Search  ○ Combined        │ │
│ │ Date Range: [1990] to [2024]                           │ │
│ │ Patent Offices: ☑ USPTO ☑ EPO ☑ WIPO ☐ JPO           │ │
│ │                                                         │ │
│ │ [AI Search] [Advanced Search] [Clear]                   │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Search Results Area                                         │
│ ┌─ Results Header ──────────────────────────────────────── │
│ │ 47 results found | Sorted by: Relevance ▼              │ │
│ │ [Select All] [Compare Selected] [Export Selected]       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Results list - see detailed spec below]                   │
└─────────────────────────────────────────────────────────────┘
```

#### **Search Result Card Specification**
```
┌─ Result Card (each result) ────────────────────────────────┐
│ ┌─ Header Row ─────────────────────────────────────────────┐ │
│ │ ☐ US Patent 9,123,456              Relevance: 87% ●●●●○ │ │
│ │ [View Full] [Add to Collection] [Export]     [Bookmark] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Title: "Method and System for Automated Patent Analysis"   │
│ Inventors: Smith, J.; Johnson, A.                          │
│ Filed: Mar 15, 2019 | Granted: Aug 22, 2020               │
│                                                             │
│ Abstract (truncated):                                       │
│ "A computer-implemented method for analyzing patent         │
│ documents using machine learning techniques to identify     │
│ relevant prior art and assess patentability..."            │
│                                                             │
│ ┌─ AI Analysis ─────────────────────────────────────────────┐ │
│ │ Conflict Assessment: Low Risk                    83% ●●●●○│ │
│ │ Key Overlaps: Claims 1-3, Figure 2                       │ │
│ │ Differentiation: "Focus on semantic analysis vs keyword" │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Classifications: G06F 17/27, G06F 17/30                   │
│ Citations: 23 cited by | 15 citing                         │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 Portfolio Analytics Dashboard

#### **Analytics Layout Structure**
```
┌─────────────────────────────────────────────────────────────┐
│ Analytics Header                                            │
│ ┌─ "Portfolio Analytics" (text-2xl, font-semibold)         │
│ │   Time Range: [Last 12 months ▼] [Custom Range]          │
│ └─ [Generate Report] [Export Data] [Schedule Report]        │
├─────────────────────────────────────────────────────────────┤
│ Key Metrics Row (4 cards)                                  │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│ │ Portfolio  │ │ Filing     │ │ Grant      │ │ AI       │ │
│ │ Value      │ │ Velocity   │ │ Rate       │ │ Efficiency│ │
│ │ $2.4M      │ │ 15/month   │ │ 78%        │ │ +43%     │ │
│ │ +12% ↗     │ │ +2 ↗       │ │ -3% ↘      │ │ +8% ↗    │ │
│ └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Main Analytics Grid (2x2 layout)                           │
│ ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Technology Distribution │ │ Geographic Coverage         │ │
│ │ [Donut Chart]           │ │ [World Map Visualization]   │ │
│ │                         │ │                             │ │
│ │ • Software: 45%         │ │ • US: 67%                   │ │
│ │ • Hardware: 30%         │ │ • EU: 23%                   │ │
│ │ • AI/ML: 15%           │ │ • Asia: 10%                 │ │
│ │ • Other: 10%           │ │                             │ │
│ └─────────────────────────┘ └─────────────────────────────┘ │
│ ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Filing Trends           │ │ Competitive Landscape       │ │
│ │ [Line Chart]            │ │ [Scatter Plot]              │ │
│ │                         │ │                             │ │
│ │ [12-month trend line    │ │ [Competitor positioning     │ │
│ │  showing filings,       │ │  by patent count vs.        │ │
│ │  grants, abandonments]  │ │  technology overlap]        │ │
│ └─────────────────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### **AI Insights Panel (Right Sidebar)**
```
┌─ AI Portfolio Insights ────────────────────────────────────┐
│ Last Updated: 2 hours ago                    [Refresh]     │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Priority Recommendations ───────────────────────────────┐ │
│ │                                                          │ │
│ │ 🔶 High Priority                                         │ │
│ │ "Consider filing in blockchain/DeFi space"              │ │
│ │ Confidence: 82% | Impact: High                          │ │
│ │ [Explore Opportunities] [Dismiss]                       │ │
│ │                                                          │ │
│ │ 🔷 Medium Priority                                       │ │
│ │ "3 patents approaching maintenance deadlines"           │ │
│ │ Confidence: 95% | Impact: Medium                        │ │
│ │ [Review Deadlines] [Set Reminders]                      │ │
│ │                                                          │ │
│ │ 🔶 High Priority                                         │ │
│ │ "Competitive threat: NewTech filed 5 similar patents"   │ │
│ │ Confidence: 78% | Impact: High                          │ │
│ │ [Analyze Threats] [Strategic Response]                  │ │
│ └──────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Portfolio Health Score ──────────────────────────────────┐ │
│ │                                                          │ │
│ │ Overall Score: 87/100                     ●●●●○         │ │
│ │                                                          │ │
│ │ Breakdown:                                               │ │
│ │ • Coverage Breadth: 92/100                ●●●●●         │ │
│ │ • Filing Quality: 89/100                  ●●●●○         │ │
│ │ • Competitive Position: 81/100            ●●●●○         │ │
│ │ • Maintenance Health: 95/100              ●●●●●         │ │
│ │                                                          │ │
│ │ [View Detailed Analysis]                                 │ │
│ └──────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Market Intelligence ─────────────────────────────────────┐ │
│ │                                                          │ │
│ │ Trending Technologies:                                   │ │
│ │ 1. Quantum Computing (+15%)                             │ │
│ │ 2. Edge AI (+12%)                                       │ │
│ │ 3. Sustainability Tech (+8%)                            │ │
│ │                                                          │ │
│ │ Filing Activity:                                         │ │
│ │ • Industry Average: 12/month                            │ │
│ │ • Your Portfolio: 15/month (+25%)                       │ │
│ │                                                          │ │
│ │ [View Market Report]                                     │ │
│ └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Mobile-Responsive Design Specifications

### 3.1 Mobile Navigation Pattern

#### **Mobile Header (320px - 768px)**
```
┌─────────────────────────────────────────────────────────────┐
│ [☰] AI Patent Platform                          [🔔] [👤]   │
└─────────────────────────────────────────────────────────────┘
```

#### **Slide-Out Navigation Menu**
```
┌─────────────────────────────────────────────┐
│ ┌─ User Profile ───────────────────────────┐ │
│ │ [Avatar] Sarah Mitchell               [×] │ │
│ │ Patent Attorney                           │ │
│ └───────────────────────────────────────────┘ │
│                                             │
│ ┌─ Navigation ─────────────────────────────┐ │
│ │ 🏠 Dashboard                              │ │
│ │ 💡 Inventions                             │ │
│ │ 📄 Patents                                │ │
│ │ 🔍 Research                               │ │
│ │ 📊 Portfolio                              │ │
│ │ ⚙️ Settings                               │ │
│ └───────────────────────────────────────────┘ │
│                                             │
│ ┌─ Quick Actions ──────────────────────────┐ │
│ │ + New Invention                           │ │
│ │ 🤖 AI Analysis                            │ │
│ │ 🔍 Quick Search                           │ │
│ └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 3.2 Mobile Dashboard

#### **Mobile Dashboard Layout (Stack)**
```
┌─────────────────────────────────────────────────────────────┐
│ Page Header                                                 │
│ Portfolio Dashboard                              [Filter ⚙️] │
├─────────────────────────────────────────────────────────────┤
│ Metrics Cards (2x2 grid on mobile)                         │
│ ┌─────────────────┐ ┌─────────────────┐                   │
│ │ Active Patents  │ │ Pending Apps    │                   │
│ │      47         │ │      12         │                   │
│ └─────────────────┘ └─────────────────┘                   │
│ ┌─────────────────┐ ┌─────────────────┐                   │
│ │ AI Tasks        │ │ Portfolio Health│                   │
│ │       3         │ │    87/100       │                   │
│ └─────────────────┘ └─────────────────┘                   │
├─────────────────────────────────────────────────────────────┤
│ Mobile Tabs                                                 │
│ [Activity] [AI Insights] [Analytics]                       │
├─────────────────────────────────────────────────────────────┤
│ Tab Content (varies)                                        │
│ [Content specific to selected tab]                          │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Mobile Patent Editing

#### **Mobile Editor Interface**
```
┌─────────────────────────────────────────────────────────────┐
│ [← Back] Patent Draft                            [⋮ More]   │
├─────────────────────────────────────────────────────────────┤
│ Document Sections (Horizontal Scroll)                      │
│ [Abstract] [Claims] [Description] [Drawings]               │
├─────────────────────────────────────────────────────────────┤
│ Editor Content Area                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Text editor optimized for mobile touch]               │ │
│ │                                                         │ │
│ │ 1. A computer-implemented method...                     │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Mobile Toolbar                                              │
│ [🤖 AI] [💬 Comments] [📋 Copy] [📤 Share] [💾 Save]       │
├─────────────────────────────────────────────────────────────┤
│ AI Assistant (Slide-up Panel)                              │
│ ┌─ AI Suggestions ────────────────────────────────────────┐ │
│ │ Claim Improvement                        Conf: 87%      │ │
│ │ "Consider adding technical details..."                  │ │
│ │ [Accept] [Modify] [Dismiss]                            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Component Library Specifications

### 4.1 AI-Specific Components

#### **AIConfidenceIndicator**
```typescript
interface AIConfidenceIndicatorProps {
  confidence: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  showReasoningLink?: boolean;
}

// Visual Specifications:
// - High (85-100%): 5 green dots
// - Medium (65-84%): 3 amber dots, 2 gray
// - Low (<65%): 1-2 red dots, rest gray
// - Size sm: 12px dots, md: 16px dots, lg: 20px dots
```

#### **AISuggestionCard**
```typescript
interface AISuggestionCardProps {
  suggestion: {
    id: string;
    type: 'improvement' | 'warning' | 'alternative';
    title: string;
    content: string;
    confidence: number;
    reasoning: string[];
  };
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onRequestExplanation?: (id: string) => void;
}

// Visual Specifications:
// - Card background: white with subtle border
// - Confidence indicator in top-right
// - Action buttons at bottom: [Accept] [Modify] [Dismiss]
// - Expandable reasoning section
```

#### **AIStreamingProgress**
```typescript
interface AIStreamingProgressProps {
  progress: number; // 0-1
  status: 'idle' | 'streaming' | 'completed' | 'error';
  currentTask?: string;
  estimatedTimeRemaining?: number;
}

// Visual Specifications:
// - Animated progress bar with gradient
// - Pulsing brain icon during processing
// - Status text below progress bar
// - ETA display when available
```

### 4.2 Patent-Specific Components

#### **PatentStatusBadge**
```typescript
interface PatentStatusBadgeProps {
  status: 'pending' | 'granted' | 'rejected' | 'abandoned';
  size?: 'sm' | 'md' | 'lg';
  showDate?: boolean;
  date?: Date;
}

// Visual Specifications:
// - Pending: blue background (#2563EB)
// - Granted: green background (#059669)
// - Rejected: red background (#DC2626)
// - Abandoned: gray background (#6B7280)
```

#### **ClaimEditor**
```typescript
interface ClaimEditorProps {
  claims: PatentClaim[];
  onClaimsChange: (claims: PatentClaim[]) => void;
  aiSuggestions?: AISuggestion[];
  readOnly?: boolean;
  highlightChanges?: boolean;
}

// Visual Specifications:
// - Rich text editor with legal formatting
// - Automatic claim numbering
// - Indentation for dependent claims
// - AI suggestion highlighting overlay
```

#### **PriorArtCard**
```typescript
interface PriorArtCardProps {
  patent: {
    id: string;
    title: string;
    patentNumber: string;
    abstract: string;
    inventors: string[];
    filingDate: Date;
    grantDate?: Date;
  };
  relevanceScore?: number;
  conflictAnalysis?: AIAnalysis;
  onSelect?: (selected: boolean) => void;
  isSelected?: boolean;
}

// Visual Specifications:
// - Card layout with selectable checkbox
// - Relevance score with color-coded indicator
// - Truncated abstract with "Read more" link
// - Patent number prominently displayed
```

### 4.3 Layout Components

#### **DashboardMetricCard**
```typescript
interface DashboardMetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  icon?: React.ComponentType;
  onClick?: () => void;
}

// Visual Specifications:
// - 200px × 120px minimum size
// - White background with subtle border
// - Large value display (text-3xl)
// - Change indicator with arrow and color
```

#### **WizardProgress**
```typescript
interface WizardProgressProps {
  steps: string[];
  currentStep: number;
  completedSteps?: number[];
  onStepClick?: (step: number) => void;
}

// Visual Specifications:
// - Horizontal step indicator
// - Completed: filled circle with checkmark
// - Current: filled circle with border
// - Future: empty circle
// - Connected by lines
```

---

## 5. Interaction Patterns & Micro-interactions

### 5.1 AI Interaction Patterns

#### **AI Suggestion Appearance**
- **Trigger:** After user completes text input (500ms debounce)
- **Animation:** Slide in from right with fade effect (300ms)
- **Visual Cue:** Subtle pulsing border to indicate AI processing
- **Sound:** Optional subtle notification sound (user configurable)

#### **Confidence Level Changes**
- **Visual:** Smooth color transition when confidence updates
- **Timing:** Update immediately on new AI data
- **Feedback:** Subtle scale animation (1.0 → 1.05 → 1.0) on significant changes

#### **AI Processing States**
- **Loading:** Skeleton screens with shimmer effect
- **Processing:** Animated progress bar with breathing effect
- **Error:** Red error state with retry option
- **Success:** Green checkmark with subtle celebration animation

### 5.2 Document Editing Interactions

#### **Real-time Collaboration**
- **Cursor Indicators:** Colored cursors with user names
- **Selection Highlighting:** Translucent colored overlays
- **Change Tracking:** Fade-in animation for new changes
- **Conflict Resolution:** Modal overlay with side-by-side comparison

#### **Auto-save Feedback**
- **Visual:** Small "Saving..." indicator in top-right
- **Timing:** Show immediately on change, hide after save confirmation
- **States:** "Saving..." → "Saved" → fade out after 2 seconds

### 5.3 Navigation & Layout

#### **Mobile Menu Transitions**
- **Slide-out:** 300ms ease-out from left edge
- **Backdrop:** Fade in dark overlay (0.5 opacity)
- **Close:** Slide back with backdrop fade-out

#### **Tab Switching**
- **Content:** Fade out current (150ms) → Fade in new (150ms)
- **Indicator:** Smooth slide animation under active tab
- **Loading:** Skeleton content during data fetch

---

## 6. Implementation Guidelines

### 6.1 Responsive Breakpoints

```css
/* Mobile First Approach */
/* Mobile: 320px - 767px */
@media (min-width: 320px) { }

/* Tablet: 768px - 1023px */
@media (min-width: 768px) { }

/* Desktop: 1024px - 1439px */
@media (min-width: 1024px) { }

/* Large Desktop: 1440px+ */
@media (min-width: 1440px) { }
```

### 6.2 Performance Considerations

#### **Image Optimization**
- Use next/image for automatic optimization
- Provide WEBP/AVIF formats with fallbacks
- Implement lazy loading for non-critical images
- Use appropriate sizes for different breakpoints

#### **Code Splitting**
- Split AI components into separate bundles
- Lazy load complex visualizations
- Implement progressive enhancement for advanced features

#### **Caching Strategy**
- Cache static assets with long TTL
- Implement stale-while-revalidate for API data
- Use service worker for offline functionality

### 6.3 Accessibility Implementation

#### **Keyboard Navigation**
- Implement focus management for modal dialogs
- Provide skip links for main content areas
- Ensure all interactive elements are keyboard accessible
- Use proper ARIA labels for complex components

#### **Screen Reader Support**
- Implement live regions for dynamic content updates
- Provide descriptive text for visual elements
- Use semantic HTML elements appropriately
- Test with actual screen reader software

---

These detailed wireframe descriptions and specifications provide comprehensive implementation guidelines that can be used to build the component library and pages without requiring actual Figma files. Each specification includes visual details, interaction patterns, and technical requirements needed for accurate implementation.