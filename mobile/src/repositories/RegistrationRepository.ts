import { api, cleanParams, http } from '../api/client';
import type { FormDefinition, FormSubmission, RegistrationRole, Team } from '../api/types';

export interface UploadedFormFile {
  field_key: string;
  url: string;
  name?: string;
  size?: number;
  mime?: string;
}

export interface SubmitRegistrationDto {
  formId: string;
  eventId: string;
  answers: Record<string, unknown>;
  files?: UploadedFormFile[];
  role: RegistrationRole;
  teamVisibility?: 'open' | 'invite_only' | 'closed';
}

export class RegistrationRepository {
  /** GET /forms/:id — the dynamic field schema for an event's registration. */
  getForm(formId: string): Promise<FormDefinition> {
    return api.get<FormDefinition>(`/forms/${formId}`);
  }

  /** POST /registrations */
  submit(dto: SubmitRegistrationDto): Promise<FormSubmission> {
    return api.post<FormSubmission>('/registrations', {
      form_id: dto.formId,
      owner: { type: 'event', id: dto.eventId },
      answers: dto.answers,
      ...(dto.files?.length ? { files: dto.files } : {}),
      context: {
        event: {
          role: dto.role,
          ...(dto.role === 'captain' && dto.teamVisibility ? { team_visibility: dto.teamVisibility } : {}),
        },
      },
    });
  }

  /** GET /registrations — the caller's own registrations, newest first (bare array). */
  mine(params: { status?: string; limit?: number; offset?: number } = {}): Promise<FormSubmission[]> {
    return api.get<FormSubmission[]>('/registrations', { params: cleanParams(params) });
  }

  /** DELETE /registrations/:id — cancels and returns the updated row. */
  cancel(registrationId: string, reason?: string): Promise<FormSubmission> {
    return api.delete<FormSubmission>(`/registrations/${registrationId}`, {
      data: reason ? { reason } : {},
    });
  }

  /** GET /teams?owner_id= — teams forming for an event (bare array). */
  teamsForEvent(eventId: string): Promise<Team[]> {
    return api.get<Team[]>('/teams', { params: { owner_id: eventId, limit: 100 } });
  }

  /** POST /teams — only an approved, confirmed captain can create a team. */
  createTeam(eventId: string, name: string, joinPolicy: 'open' | 'invite_only' | 'closed' = 'open'): Promise<Team> {
    return api.post<Team>('/teams', { owner: { type: 'event', id: eventId }, name, join_policy: joinPolicy });
  }

  /** POST /teams/:id/join — joins an open team (or accepts an invite). */
  joinTeam(teamId: string): Promise<Team> {
    return api.post<Team>(`/teams/${teamId}/join`);
  }

  /** POST /teams/join-by-code — 8 character code shared by the captain. */
  joinTeamByCode(code: string): Promise<Team> {
    return api.post<Team>('/teams/join-by-code', { code: code.trim().toUpperCase() });
  }

  /**
   * POST /registrations/upload-file — raw file body; echo the result into `files[]`.
   * Accepts jpeg, png, webp or pdf up to 10MB.
   */
  async uploadFile(params: { formId: string; fieldKey: string; uri: string; name: string; mimeType: string }): Promise<UploadedFormFile> {
    const blob = await (await fetch(params.uri)).blob();
    const res = await http.post<UploadedFormFile>('/registrations/upload-file', blob, {
      params: { form_id: params.formId, field_key: params.fieldKey, name: params.name },
      headers: { 'Content-Type': params.mimeType },
      timeout: 120000,
      transformRequest: [(data) => data],
    });
    return res.data;
  }
}

export const registrationRepository = new RegistrationRepository();
