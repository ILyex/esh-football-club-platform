import { playerSchema } from '@/lib/validations/player';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('playerSchema preprocessing', () => {
  it('accepts empty string for optional numeric fields', () => {
    const raw = {
      firstName: 'John',
      lastName: 'Doe',
      position: 'FORWARD',
      nationality: 'USA',
      dateOfBirth: '2000-01-01',
      teamId: 'team-123',
      shirtNumber: '', // empty string should become undefined
      height: '', // empty string should become undefined
      weight: '', // empty string should become undefined
      previousTeam: '', // empty string should become undefined
      birthCertificateNumber: '', // empty string should become undefined
      preferredFoot: '', // empty string should become undefined
      joiningDate: '', // empty string should become undefined
    };
    const parsed = playerSchema.parse(raw);
    assert.equal(parsed.shirtNumber, undefined);
    assert.equal(parsed.height, undefined);
    assert.equal(parsed.weight, undefined);
    assert.equal(parsed.previousTeam, undefined);
    assert.equal(parsed.birthCertificateNumber, undefined);
    assert.equal(parsed.preferredFoot, undefined);
    assert.equal(parsed.joiningDate, undefined);
  });

  it('accepts a blank team for club-wide players because Player.teamId is nullable', () => {
    const parsed = playerSchema.parse({
      firstName: 'Ahmed',
      lastName: 'Test',
      position: 'MIDFIELDER',
      nationality: 'DZ',
      dateOfBirth: '2000-01-01',
      teamId: ''
    });
    assert.equal(parsed.teamId, null);
  });

  it('parses valid numeric and text strings correctly', () => {
    const raw = {
      firstName: 'Jane',
      lastName: 'Smith',
      position: 'MIDFIELDER',
      nationality: 'FR',
      dateOfBirth: '1995-05-10',
      teamId: 'team-456',
      shirtNumber: '10',
      height: '175',
      weight: '68.5',
      previousTeam: 'JS Kabylie',
      birthCertificateNumber: '12345/2000',
    };
    const parsed = playerSchema.parse(raw);
    assert.equal(parsed.shirtNumber, 10);
    assert.equal(parsed.height, 175);
    assert.equal(parsed.weight, 68.5);
    assert.equal(parsed.previousTeam, 'JS Kabylie');
    assert.equal(parsed.birthCertificateNumber, '12345/2000');
  });
});
