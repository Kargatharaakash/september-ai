// Centralized error helpers and types

export class ExternalServiceError extends Error {
  service: string;
  original?: any;
  constructor(service: string, message: string, original?: any) {
    super(message);
    this.name = 'ExternalServiceError';
    this.service = service;
    this.original = original;
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}