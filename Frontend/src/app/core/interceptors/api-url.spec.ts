import { isApiUrl } from './api-url';

describe('Périmètre du JWT web et Capacitor', () => {
  const origin = 'http://localhost:8100';
  it('reconnaît les chemins API web sans accepter un préfixe voisin', () => {
    expect(isApiUrl('/api/events', '/api', origin)).toBe(true);
    expect(isApiUrl('/api-other/events', '/api', origin)).toBe(false);
    expect(isApiUrl('https://example.org/api/events', '/api', origin)).toBe(false);
    expect(isApiUrl('//example.org/api/events', '/api', origin)).toBe(false);
  });
  it('autorise uniquement l’API distante configurée sur mobile', () => {
    const api = 'https://api.eventhub.test/api';
    expect(isApiUrl(api + '/events', api, origin)).toBe(true);
    expect(isApiUrl('https://api.eventhub.test.evil.org/api/events', api, origin)).toBe(false);
    expect(isApiUrl('/api/events', api, origin)).toBe(false);
    expect(isApiUrl('https://api.eventhub.test/account', api, origin)).toBe(false);
  });
  it('normalise les chemins avant de vérifier leur appartenance à l’API', () => {
    expect(isApiUrl('/api/../private', '/api/', origin)).toBe(false);
    expect(isApiUrl('/api/events?category=1', '/api/', origin)).toBe(true);
  });
});
