export const isEmail = (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
  
  export const passwordIssues = (v) => {
    const s = String(v || "");
    const issues = [];
    if (s.length < 8) issues.push("At least 8 characters");
    if (!/[A-Z]/.test(s)) issues.push("One uppercase letter");
    if (!/[a-z]/.test(s)) issues.push("One lowercase letter");
    if (!/[0-9]/.test(s)) issues.push("One number");
    return issues;
  };
  