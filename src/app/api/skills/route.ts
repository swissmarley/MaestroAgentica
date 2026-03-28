import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Pre-built skills following Claude Code Skills filesystem-based standard
const PREBUILT_SKILLS = [
  {
    id: "code-review",
    name: "Code Review",
    description: "Thorough code review with focus on bugs, security, and best practices.",
    category: "Development",
    version: "1.0.0",
    triggers: ["code review", "review code", "review PR"],
    content: `---
name: code-review
description: Perform thorough code reviews focusing on correctness, security, and maintainability
version: 1.0.0
triggers:
  - "code review"
  - "review code"
  - "review PR"
type: skill
---

# Code Review Skill

When reviewing code, follow this systematic approach:

## Review Checklist
1. **Correctness**: Does the code do what it's supposed to do?
2. **Security**: Are there any vulnerabilities (injection, XSS, auth bypass)?
3. **Performance**: Are there unnecessary computations or N+1 queries?
4. **Readability**: Is the code clear and well-organized?
5. **Error Handling**: Are edge cases and errors handled gracefully?
6. **Testing**: Are there adequate tests for the changes?

## Output Format
- Start with a brief summary of the changes
- List issues by severity: Critical > Warning > Suggestion
- Provide specific line references and fix suggestions
- End with an overall assessment`,
  },
  {
    id: "api-designer",
    name: "API Designer",
    description: "Design RESTful APIs with proper patterns, validation, and documentation.",
    category: "Development",
    version: "1.0.0",
    triggers: ["design api", "api design", "REST API"],
    content: `---
name: api-designer
description: Design clean RESTful APIs with proper HTTP methods, status codes, and validation
version: 1.0.0
triggers:
  - "design api"
  - "api design"
  - "REST API"
type: skill
---

# API Design Skill

## Principles
- Use proper HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Return appropriate status codes (200, 201, 400, 401, 403, 404, 500)
- Use consistent naming conventions (plural nouns for collections)
- Implement pagination for list endpoints
- Include proper error response bodies with error codes and messages
- Version APIs when breaking changes are needed

## Response Format
\`\`\`json
{
  "data": {},
  "meta": { "page": 1, "total": 100 },
  "errors": []
}
\`\`\`

## Validation
- Validate all input at the boundary
- Use schema validation (Zod, Joi, etc.)
- Return descriptive validation error messages`,
  },
  {
    id: "test-writer",
    name: "Test Writer",
    description: "Write comprehensive test suites with proper coverage and edge cases.",
    category: "Testing",
    version: "1.0.0",
    triggers: ["write tests", "test writer", "create tests"],
    content: `---
name: test-writer
description: Write comprehensive tests covering happy paths, edge cases, and error scenarios
version: 1.0.0
triggers:
  - "write tests"
  - "test writer"
  - "create tests"
type: skill
---

# Test Writing Skill

## Test Structure (AAA Pattern)
1. **Arrange**: Set up test data and preconditions
2. **Act**: Execute the code under test
3. **Assert**: Verify the expected outcome

## Coverage Requirements
- Happy path for each function/endpoint
- Edge cases (empty input, null, boundary values)
- Error scenarios (invalid input, network failures)
- Integration between components

## Naming Convention
Use descriptive test names: \`should [expected behavior] when [condition]\`

## Best Practices
- Each test should be independent
- Use factories/fixtures for test data
- Mock external dependencies at the boundary
- Test behavior, not implementation details`,
  },
  {
    id: "docs-writer",
    name: "Documentation Writer",
    description: "Write clear, structured technical documentation and README files.",
    category: "Documentation",
    version: "1.0.0",
    triggers: ["write docs", "documentation", "write README"],
    content: `---
name: docs-writer
description: Write clear technical documentation following best practices
version: 1.0.0
triggers:
  - "write docs"
  - "documentation"
  - "write README"
type: skill
---

# Documentation Writing Skill

## Document Structure
1. **Overview**: What is this and why does it exist?
2. **Quick Start**: Get running in under 5 minutes
3. **Installation**: Step-by-step setup instructions
4. **Usage**: Common use cases with examples
5. **API Reference**: Detailed function/endpoint documentation
6. **Configuration**: Available options and defaults
7. **Troubleshooting**: Common issues and solutions

## Writing Style
- Use active voice and present tense
- Keep sentences short and scannable
- Include code examples for every concept
- Use consistent terminology throughout`,
  },
  {
    id: "sql-expert",
    name: "SQL Expert",
    description: "Write optimized SQL queries with proper indexing and performance considerations.",
    category: "Data",
    version: "1.0.0",
    triggers: ["sql query", "optimize SQL", "database query"],
    content: `---
name: sql-expert
description: Write optimized SQL queries with proper indexing strategies and performance tuning
version: 1.0.0
triggers:
  - "sql query"
  - "optimize SQL"
  - "database query"
type: skill
---

# SQL Expert Skill

## Query Optimization
- Use EXPLAIN ANALYZE to verify query plans
- Avoid SELECT * in production queries
- Use appropriate JOIN types (INNER, LEFT, etc.)
- Add indexes for frequently queried columns
- Use CTEs for complex queries to improve readability

## Best Practices
- Always use parameterized queries (prevent SQL injection)
- Use transactions for multi-statement operations
- Implement proper pagination (keyset over offset)
- Consider query result caching for expensive operations
- Use appropriate data types for columns`,
  },
  {
    id: "security-auditor",
    name: "Security Auditor",
    description: "Audit code for security vulnerabilities following OWASP guidelines.",
    category: "Security",
    version: "1.0.0",
    triggers: ["security audit", "vulnerability scan", "OWASP check"],
    content: `---
name: security-auditor
description: Audit code for OWASP Top 10 vulnerabilities and security best practices
version: 1.0.0
triggers:
  - "security audit"
  - "vulnerability scan"
  - "OWASP check"
type: skill
---

# Security Audit Skill

## OWASP Top 10 Checklist
1. **Injection**: SQL, NoSQL, OS command, LDAP injection
2. **Broken Auth**: Weak passwords, session management
3. **Sensitive Data**: Encryption at rest and in transit
4. **XXE**: XML external entity attacks
5. **Broken Access Control**: IDOR, privilege escalation
6. **Misconfig**: Default credentials, unnecessary features
7. **XSS**: Reflected, stored, DOM-based
8. **Insecure Deserialization**: Untrusted data processing
9. **Known Vulnerabilities**: Outdated dependencies
10. **Insufficient Logging**: Missing audit trails

## Report Format
- Severity: Critical / High / Medium / Low / Info
- Description of the vulnerability
- Affected code location
- Proof of concept
- Recommended fix`,
  },
  {
    id: "refactoring-guide",
    name: "Refactoring Guide",
    description: "Identify and apply common refactoring patterns to improve code quality.",
    category: "Development",
    version: "1.0.0",
    triggers: ["refactor", "refactoring", "improve code quality"],
    content: `---
name: refactoring-guide
description: Apply systematic refactoring patterns to improve code quality without changing behavior
version: 1.0.0
triggers:
  - "refactor"
  - "refactoring"
  - "improve code quality"
type: skill
---

# Refactoring Guide Skill

## Common Refactoring Patterns
- **Extract Method**: Break long functions into smaller, named pieces
- **Rename**: Use clear, descriptive names for variables and functions
- **Remove Duplication**: DRY - consolidate repeated logic
- **Simplify Conditionals**: Replace complex if/else with guard clauses or strategy pattern
- **Encapsulate**: Hide implementation details behind clean interfaces

## Process
1. Ensure tests exist before refactoring
2. Make one small change at a time
3. Run tests after each change
4. Commit frequently

## Red Flags to Address
- Functions longer than 20 lines
- More than 3 levels of nesting
- Functions with more than 3 parameters
- Duplicated code blocks
- Comments explaining "what" instead of "why"`,
  },
  {
    id: "prompt-engineer",
    name: "Prompt Engineer",
    description: "Design effective prompts and system instructions for AI agents.",
    category: "AI",
    version: "1.0.0",
    triggers: ["prompt engineering", "design prompt", "system instructions"],
    content: `---
name: prompt-engineer
description: Design effective prompts and system instructions for AI agents
version: 1.0.0
triggers:
  - "prompt engineering"
  - "design prompt"
  - "system instructions"
type: skill
---

# Prompt Engineering Skill

## System Prompt Structure
1. **Role Definition**: Who is the agent and what is its purpose?
2. **Capabilities**: What can the agent do?
3. **Constraints**: What should the agent NOT do?
4. **Output Format**: How should responses be structured?
5. **Examples**: Few-shot examples of ideal behavior

## Best Practices
- Be specific and unambiguous
- Use structured formatting (headers, lists, XML tags)
- Include examples of desired behavior
- Define edge case handling explicitly
- Test with adversarial inputs
- Iterate based on failure cases

## Anti-Patterns to Avoid
- Vague instructions ("be helpful")
- Contradicting rules
- Overly long prompts that dilute focus
- Missing error handling instructions`,
  },
];

// GET /api/skills - List all pre-built skills
export async function GET() {
  return NextResponse.json({
    skills: PREBUILT_SKILLS,
  });
}

// POST /api/skills - Create/validate a custom skill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, content, category } = body;

    if (!name?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Name and content are required" },
        { status: 400 }
      );
    }

    // Validate skill format (should have frontmatter)
    const hasFrontmatter = content.trim().startsWith("---");
    const kebabName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const skill = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || "",
      category: category?.trim() || "Custom",
      version: body.version || "1.0.0",
      triggers: body.triggers || [],
      content: hasFrontmatter ? content : `---
name: ${kebabName}
description: ${description?.trim() || name.trim()}
version: ${body.version || "1.0.0"}
type: skill
---

${content}`,
      isCustom: true,
      packageName: kebabName,
    };

    return NextResponse.json(skill, { status: 201 });
  } catch (err) {
    console.error("POST /api/skills error:", err);
    return NextResponse.json(
      { error: "Failed to create skill" },
      { status: 500 }
    );
  }
}
