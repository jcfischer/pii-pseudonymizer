/**
 * Pseudonym Generator
 * Generates consistent, realistic fake data for PII using Faker.js
 */

import { faker } from "@faker-js/faker";
import type { EntityType } from "../types";

// =============================================================================
// Hash Function for Seeding
// =============================================================================

/**
 * Simple hash function to convert string to number for seeding
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// =============================================================================
// Pseudonym Generator Class
// =============================================================================

export class PseudonymGenerator {
  private locale: string;

  constructor(locale: string = "en") {
    this.locale = locale;
  }

  /**
   * Generate a pseudonym for a given entity type and original value
   * The same original value will always produce the same pseudonym
   */
  generate(type: EntityType, original: string): string {
    // Seed Faker with hash of original for consistency
    const seed = hashString(`${type}:${original}`);
    faker.seed(seed);

    switch (type) {
      case "PERSON":
        return this.generatePersonName();
      case "ORG":
        return this.generateCompanyName();
      case "EMAIL":
        return this.generateEmail();
      case "PHONE":
        return this.generatePhone();
      case "DOMAIN":
        return this.generateDomain();
      case "URL":
        return this.generateURL();
      case "IP":
        return this.generateIP();
      case "LOCATION":
        return this.generateLocation();
      case "DATE":
        return this.generateDate();
      default:
        // Fallback: return a generic placeholder
        return `[REDACTED_${type}]`;
    }
  }

  /**
   * Generate a realistic person name
   */
  private generatePersonName(): string {
    return faker.person.fullName();
  }

  /**
   * Generate a realistic company name
   */
  private generateCompanyName(): string {
    return faker.company.name();
  }

  /**
   * Generate a realistic email address
   */
  private generateEmail(): string {
    return faker.internet.email().toLowerCase();
  }

  /**
   * Generate a realistic phone number
   */
  private generatePhone(): string {
    // Generate US-style phone for consistency
    const area = faker.string.numeric(3);
    const exchange = faker.string.numeric(3);
    const subscriber = faker.string.numeric(4);
    return `(${area}) ${exchange}-${subscriber}`;
  }

  /**
   * Generate a realistic domain name
   */
  private generateDomain(): string {
    return faker.internet.domainName();
  }

  /**
   * Generate a realistic URL
   */
  private generateURL(): string {
    return faker.internet.url();
  }

  /**
   * Generate a realistic IPv4 address
   */
  private generateIP(): string {
    return faker.internet.ipv4();
  }

  /**
   * Generate a realistic location/city name
   */
  private generateLocation(): string {
    return faker.location.city();
  }

  /**
   * Generate a date string
   */
  private generateDate(): string {
    const date = faker.date.past();
    return date.toISOString().split("T")[0];
  }
}
