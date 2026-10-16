import axios, { AxiosError } from 'axios';
import {
  User,
  UserRole,
  RegisterData,
  Claim,
  ClaimDetail,
  ClaimSubmitData,
  PatientDashboard,
  PaginatedResponse,
  PaginationParams,
  Document,
  Policy,
  PolicyData,
  PatientProfile,
  InvestigatorDashboard,
  ClaimQueueItem,
  ClaimQueueParams,
  InvestigatorClaimDetail,
  Note,
  DocRequestData,
  DecisionData,
  RiskAssessment,
  RiskPriority,
  DuplicateMatch,
  AuditLog,
  AuditLogParams,
  AnalyticsParams,
  DashboardCharts,
  TimeSeriesData,
  StatusData,
  RiskData,
  RuleData,
  ProviderData,
  AmountData,
  DuplicateExposureData,
} from '@/types';
import { mockPatientDashboard, mockInvestigatorDashboard, mockClaims, mockInvestigatorClaimDetail, mockAnalyticsDashboard, mockAuditLogs, mockDuplicates, mockPolicies, mockUserProfile } from './mock-data';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 8000,
});

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('claimlens_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      localStorage.removeItem('claimlens_token');
      localStorage.removeItem('claimlens_user');
      document.cookie = 'claimlens_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;';
      document.cookie = 'claimlens_role=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;';
      // In demo mode or when on login, do not force a hard reload so fallback data can function smoothly
      if (!IS_DEMO_MODE && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Fallback helper to allow offline demo operation if API server is not running
async function executeApiCall<T>(call: () => Promise<{ data: T }>, fallback: () => T): Promise<T> {
  try {
    const res = await call();
    return res.data;
  } catch (err: any) {
    if (!err.response && (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error'))) {
      console.warn('API server unreachable, serving fallback data for offline mode:', err.message);
      return fallback();
    }
    throw err;
  }
}

export const authAPI = {
  async login(email: string, password: string): Promise<{ access_token: string; user: User }> {
    return executeApiCall(
      async () => {
        const res = await apiClient.post('/auth/login', {
          username_or_email: email,
          email: email,
          username: email,
          password,
        });
        const u = res.data?.user || {};
        const mappedUser: User = {
          id: u.id,
          name: u.full_name || u.name || (email.includes('investigator') ? 'Vikram Rathore' : (email.includes('@') ? email.split('@')[0] : 'Patient User')),
          email: u.email || email,
          role: u.role || (email.includes('admin') ? 'admin' : email.includes('investigator') ? 'investigator' : 'patient'),
          phone: u.phone,
          dateOfBirth: u.date_of_birth || u.dateOfBirth,
          address: u.address,
        };
        return {
          data: {
            access_token: res.data.access_token,
            user: mappedUser,
          },
        };
      },
      () => {
        const isInvestigator = email.includes('investigator') || email.includes('admin');
        const role = email.includes('admin') ? 'admin' : isInvestigator ? 'investigator' : 'patient';
        const user: User = {
          id: isInvestigator ? 'usr-inv-01' : 'usr-pat-01',
          name: isInvestigator ? 'Vikram Rathore' : 'Aarav Sharma',
          email,
          role,
          phone: '+91 98765 43210',
          dateOfBirth: '1988-06-15',
          address: '742 Lotus Boulevard, Indiranagar, Bengaluru, KA 560038',
        };
        return { access_token: 'mock-jwt-token-' + Date.now(), user };
      }
    );
  },

  async register(data: RegisterData): Promise<User> {
    return executeApiCall(
      async () => {
        const res = await apiClient.post('/auth/register', data);
        const u = res.data;
        return {
          data: {
            id: u.id,
            name: u.full_name || data.name,
            email: u.email || data.email,
            role: u.role || 'patient',
            phone: data.phone,
            dateOfBirth: data.dateOfBirth,
            address: data.address,
          },
        };
      },
      () => ({
        id: 'usr-' + Date.now(),
        name: data.name,
        email: data.email,
        role: 'patient',
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        address: data.address,
      })
    );
  },

  async me(): Promise<User> {
    return executeApiCall<User>(
      async () => {
        const res = await apiClient.get('/auth/me');
        const u = res.data;
        const mappedUser: User = {
          id: u.id,
          name: u.full_name || u.name,
          email: u.email,
          role: u.role,
          phone: u.phone,
          dateOfBirth: u.date_of_birth || u.dateOfBirth,
          address: u.address,
          createdAt: u.created_at || u.createdAt,
        };
        return { data: mappedUser };
      },
      () => mockUserProfile
    );
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    return executeApiCall<User>(
      async () => {
        const res = await apiClient.put('/auth/me', {
          full_name: data.name,
          email: data.email,
        });
        const u = res.data;
        const mappedUser: User = {
          id: u.id,
          name: u.full_name || u.name || data.name || '',
          email: u.email || data.email || '',
          role: u.role,
          phone: u.phone || data.phone,
          dateOfBirth: u.date_of_birth || data.dateOfBirth,
          address: u.address || data.address,
          createdAt: u.created_at || u.createdAt,
        };
        return { data: mappedUser };
      },
      () => ({ ...mockUserProfile, ...data })
    );
  },
};

export function mapBackendClaim(c: any): ClaimDetail {
  if (!c) return {} as any;
  return {
    id: c.id,
    referenceNumber: c.claim_reference || c.referenceNumber || 'CLM-XXXX',
    patientId: c.patient_id || c.patientId || '',
    patientName: c.patient_name || c.patientName || (c.patient?.user?.full_name) || 'Patient',
    patientEmail: c.patient_email || c.patientEmail,
    patientPhone: c.patient_phone || c.patientPhone,
    policyId: c.policy_id || c.policy?.id || c.policyId,
    policyNumber: c.policy?.policy_number || c.policy_number || c.policyNumber || 'POL-DEF-100',
    memberReference: c.policy?.member_reference || c.member_reference || c.memberReference || 'MEM-001',
    policyType: c.policy?.policy_type || c.policyType || 'Comprehensive Health',
    copayPercentage: c.policy?.copay_percentage !== undefined ? Number(c.policy.copay_percentage) : (c.copayPercentage !== undefined ? Number(c.copayPercentage) : 0),
    deductibleAmount: c.policy?.deductible_amount !== undefined ? Number(c.policy.deductible_amount) : (c.deductibleAmount !== undefined ? Number(c.deductibleAmount) : 0),
    tpaName: c.policy?.tpa_name || c.tpaName || 'In-House TPA Desk',
    sumInsured: c.policy?.max_coverage_amount !== undefined ? Number(c.policy.max_coverage_amount) : (c.sumInsured !== undefined ? Number(c.sumInsured) : undefined),
    providerName: c.provider?.name || c.provider_name || c.providerName || 'Healthcare Provider',
    treatmentDate: c.treatment_date || c.treatmentDate || '',
    admissionDate: c.admission_date || c.admissionDate,
    dischargeDate: c.discharge_date || c.dischargeDate,
    treatmentDescription: c.treatment_description || c.treatmentDescription || '',
    billingCodes: c.billing_codes || c.billingCodes || ['CPT-99214'],
    invoiceNumber: c.invoice_number || c.invoiceNumber || 'INV-000',
    claimedAmount: Number(c.total_claimed_amount ?? c.claimedAmount ?? 0),
    approvedAmount: c.approved_amount !== null && c.approved_amount !== undefined ? Number(c.approved_amount) : (c.approvedAmount !== undefined ? Number(c.approvedAmount) : undefined),
    settledAmount: c.settled_amount !== null && c.settled_amount !== undefined ? Number(c.settled_amount) : (c.settledAmount !== undefined ? Number(c.settledAmount) : undefined),
    rejectionReason: c.rejection_reason || c.rejectionReason,
    status: c.status || 'under_review',
    riskScore: Number(c.risk_score ?? c.riskScore ?? 0),
    riskLevel: (c.risk_priority || c.riskLevel || 'low') as any,
    assignedTo: c.assigned_investigator_id || c.assignedTo,
    assignedToName: c.assigned_investigator_name || c.assignedToName,
    createdAt: c.created_at || c.createdAt || new Date().toISOString(),
    updatedAt: c.updated_at || c.updatedAt || new Date().toISOString(),
    lineItems: (c.line_items || c.lineItems || []).map((l: any, i: number) => ({
      id: l.id || `li-${i}`,
      claimId: l.claim_id || l.claimId || c.id,
      serviceDescription: l.service_description || l.serviceDescription || 'Medical Service',
      billingCode: l.billing_code || l.billingCode || 'CPT-99214',
      quantity: Number(l.quantity || 1),
      unitAmount: Number(l.unit_amount ?? l.unitAmount ?? 0),
      totalAmount: Number(l.line_total ?? l.totalAmount ?? 0),
    })),
    documents: (c.documents || []).map((d: any) => ({
      id: d.id,
      claimId: d.claim_id || d.claimId || c.id,
      name: d.filename || d.name || 'document.pdf',
      documentType: d.document_type || d.documentType || 'medical_bills',
      fileUrl: d.file_path || d.fileUrl || '/mock/bill1.pdf',
      fileSize: Number(d.file_size || d.fileSize || 1024),
      mimeType: d.mime_type || d.mimeType || 'application/pdf',
      uploadedAt: d.uploaded_at || d.uploadedAt || new Date().toISOString(),
      verified: true,
    })),
    documentRequests: (c.document_requests || c.documentRequests || []).map((dr: any) => ({
      id: dr.id,
      claimId: dr.claim_id || dr.claimId || c.id,
      documentTypes: Array.isArray(dr.document_types) ? dr.document_types : (Array.isArray(dr.documentTypes) ? dr.documentTypes : []),
      message: dr.message,
      requestedAt: dr.created_at || dr.requestedAt || new Date().toISOString(),
      status: dr.status || 'pending',
      fulfilledAt: dr.fulfilled_at || dr.fulfilledAt,
    })),
    statusExplanations: c.status_explanations || c.statusExplanations,
    timeline: (c.status_history || c.timeline || []).map((h: any, idx: number) => ({
      id: h.id || `hist-${idx}`,
      claimId: h.claim_id || h.claimId || c.id,
      timestamp: h.timestamp || h.created_at || new Date().toISOString(),
      status: h.to_status || h.status || 'under_review',
      title: (h.to_status || h.status || 'Status Updated').replace(/_/g, ' ').toUpperCase(),
      description: h.reason || h.description || `Claim transitioned to ${h.to_status || h.status}`,
      actor: h.changed_by_name || h.actor,
    })),
  };
}

function mapBackendRiskAssessment(ra: any, claimId?: string): RiskAssessment {
  return {
    id: ra.id,
    claimId: ra.claim_id || ra.claimId || claimId || '',
    riskScore: Number(ra.score ?? ra.riskScore ?? 0),
    priority: (ra.priority || 'low') as RiskPriority,
    rulesTriggered: Number(
      ra.triggered_rule_count ??
      ra.rulesTriggered ??
      (ra.findings || []).length
    ),
    assessedAt: ra.assessed_at || ra.assessedAt || new Date().toISOString(),
    findings: (ra.findings || []).map((f: any) => ({
      id: f.id,
      ruleId: f.rule_id || f.ruleId,
      ruleName: f.rule_name || f.ruleName,
      severity: (f.severity || 'low') as RiskPriority,
      scoreContribution: Number(
        f.score_contribution ?? f.scoreContribution ?? 0
      ),
      explanation: f.explanation,
      evidence:
        typeof f.evidence === 'string'
          ? JSON.parse(f.evidence)
          : (f.evidence || {}),
      isFalsePositive: Boolean(
        f.is_false_positive ?? f.isFalsePositive ?? false
      ),
      falsePositiveReason:
        f.false_positive_reason || f.falsePositiveReason,
    })),
  };
}
export function mapBackendInvestigatorClaim(c: any): InvestigatorClaimDetail {
  const base = mapBackendClaim(c);
  const ra = c.risk_assessment || c.riskAssessment;
  const riskAssessment: RiskAssessment | undefined = ra
    ? mapBackendRiskAssessment(ra, c.id)
    : undefined;
  const dupMatches = (c.duplicate_matches || c.duplicateMatches || []).map((d: any) => ({
    id: d.id,
    claim1Id: d.claim_id_1 || d.claim1Id,
    claim2Id: d.claim_id_2 || d.claim2Id,
    claim1Reference: d.claim_reference || d.claim1Reference || c.claim_reference,
    claim2Reference: d.other_claim_reference || d.claim2Reference || 'CLM-MATCH',
    patientName: d.patient_name || d.patientName,
    providerName: d.provider_name || d.providerName,
    treatmentDate: d.treatment_date || d.treatmentDate,
    amount: Number(d.amount ?? 0),
    matchType: (d.match_type === 'exact' ? 'exact' : 'near_duplicate') as any,
    similarityScore: Number(d.similarity_score ?? d.similarityScore ?? 0),
    matchingFields: typeof d.matching_fields === 'string' ? Object.keys(JSON.parse(d.matching_fields)) : (Array.isArray(d.matching_fields) ? d.matching_fields : (Array.isArray(d.matchingFields) ? d.matchingFields : Object.keys(d.matching_fields || {}))),
    differingFields: typeof d.differing_fields === 'string' ? Object.keys(JSON.parse(d.differing_fields)) : (Array.isArray(d.differing_fields) ? d.differing_fields : (Array.isArray(d.differingFields) ? d.differingFields : Object.keys(d.differing_fields || {}))),
    status: (d.confirmed_duplicate ? 'confirmed_duplicate' : 'suspected') as any,
    createdAt: d.created_at || d.createdAt || new Date().toISOString(),
  }));

  const invNotes = (c.notes || c.investigatorNotes || []).map((n: any) => ({
    id: n.id,
    claimId: n.claim_id || n.claimId || c.id,
    authorId: n.author_id || n.authorId,
    authorName: n.author_name || n.authorName || 'Investigator',
    content: n.content,
    isPrivate: Boolean(n.is_private ?? n.isPrivate ?? true),
    createdAt: n.created_at || n.createdAt || new Date().toISOString(),
  }));

  return {
    ...base,
    riskAssessment,
    duplicateMatches: dupMatches,
    investigatorNotes: invNotes,
  };
}

export const patientAPI = {
  async getDashboard(): Promise<PatientDashboard> {
    return executeApiCall(
      async () => {
        const res = await apiClient.get('/patient/dashboard');
        const d = res.data || {};
        const recentClaims: Claim[] = (d.recent_claims || []).map((c: any) => mapBackendClaim(c));
        return {
          data: {
            totalClaims: Number(d.total_claims ?? 0),
            awaitingProcessing: Number(d.active_claims ?? 0),
            underReview: Number(d.active_claims ?? 0),
            approved: Number(d.approved_claims ?? 0),
            settled: Number(d.settled_claims ?? 0),
            rejected: Number(d.rejected_claims ?? 0),
            totalClaimedAmount: Number(d.total_claimed_amount ?? 0),
            totalApprovedAmount: Number(d.total_approved_amount ?? 0),
            totalSettledAmount: Number(d.total_settled_amount ?? 0),
            recentClaims,
          },
        };
      },
      () => mockPatientDashboard
    );
  },

  async getClaims(params?: PaginationParams): Promise<PaginatedResponse<Claim>> {
    return executeApiCall(
      async () => {
        const p = params?.page || 1;
        const lim = params?.limit || 10;
        const res = await apiClient.get('/patient/claims', {
          params: {
            page: p,
            page_size: lim,
            status: params?.status && params.status !== 'all' ? params.status : undefined,
          },
        });
        const rawItems = res.data?.items || (Array.isArray(res.data) ? res.data : []);
        let items: Claim[] = rawItems.map((c: any) => mapBackendClaim(c));
        if (params?.search) {
          const q = params.search.toLowerCase();
          items = items.filter(
            (c) =>
              c.referenceNumber.toLowerCase().includes(q) ||
              c.providerName.toLowerCase().includes(q) ||
              c.invoiceNumber.toLowerCase().includes(q)
          );
        }
        return {
          data: {
            items,
            total: Number(res.data?.total ?? items.length),
            page: Number(res.data?.page ?? p),
            limit: Number(res.data?.page_size ?? lim),
            totalPages: Number(res.data?.total_pages ?? (Math.ceil(items.length / lim) || 1)),
          },
        };
      },
      () => {
        let items = [...mockClaims];
        if (params?.search) {
          const q = params.search.toLowerCase();
          items = items.filter(c => c.referenceNumber.toLowerCase().includes(q) || c.providerName.toLowerCase().includes(q));
        }
        if (params?.status && params.status !== 'all') {
          items = items.filter(c => c.status === params.status);
        }
        const page = params?.page || 1;
        const limit = params?.limit || 10;
        const start = (page - 1) * limit;
        return {
          items: items.slice(start, start + limit),
          total: items.length,
          page,
          limit,
          totalPages: Math.ceil(items.length / limit) || 1,
        };
      }
    );
  },

  async getClaim(id: string): Promise<ClaimDetail> {
    return executeApiCall(
      async () => {
        const res = await apiClient.get(`/patient/claims/${id}`);
        return { data: mapBackendClaim(res.data) };
      },
      () => {
        const found = mockClaims.find(c => c.id === id) || mockClaims[0];
        return {
          ...found,
          statusExplanations: 'Your claim is actively progressing through our automated verification and risk screening pipeline. Hospital invoices and billed procedures are verified.',
        };
      }
    );
  },

  async submitClaim(data: ClaimSubmitData): Promise<Claim> {
    return executeApiCall(
      async () => {
        const body: any = {
          patient_name: data.patientName || data.patient_name,
          patientName: data.patientName || data.patient_name,
          policy_id: data.policyId,
          policyId: data.policyId,
          policy_number: data.policyNumber,
          policyNumber: data.policyNumber,
          provider_name: data.providerName,
          providerName: data.providerName,
          treatment_date: data.treatmentDate,
          treatmentDate: data.treatmentDate,
          admission_date: data.admissionDate || null,
          discharge_date: data.dischargeDate || null,
          treatment_description: data.treatmentDescription || 'Medical Consultation & Care',
          invoice_number: data.invoiceNumber || `INV-${Date.now()}`,
          total_claimed_amount: data.claimedAmount,
          claimedAmount: data.claimedAmount,
          billing_codes: data.billingCodes || ['CPT-99214'],
          line_items: (data.lineItems || []).map((li, idx) => ({
            service_description: li.serviceDescription,
            serviceDescription: li.serviceDescription,
            billing_code: li.billingCode || 'CPT-99214',
            quantity: li.quantity || 1,
            unit_amount: li.unitAmount,
            unitAmount: li.unitAmount,
            line_total: li.totalAmount,
            totalAmount: li.totalAmount,
            sequence_number: idx + 1,
          })),
        };
        const res = await apiClient.post('/claims', body);
        const c = res.data;
        const mappedClaim: Claim = {
          id: c.id,
          referenceNumber: c.claim_reference || c.referenceNumber || `CLM-${Date.now()}`,
          patientId: c.patient_id || 'usr-pat-01',
          patientName: c.patient_name || data.patientName || data.patient_name || 'Patient',
          policyNumber: c.policy?.policy_number || data.policyNumber,
          memberReference: c.policy?.member_reference || data.memberReference,
          providerName: c.provider?.name || data.providerName,
          treatmentDate: c.treatment_date || data.treatmentDate,
          admissionDate: c.admission_date,
          dischargeDate: c.discharge_date,
          treatmentDescription: c.treatment_description || data.treatmentDescription,
          invoiceNumber: c.invoice_number || data.invoiceNumber,
          claimedAmount: Number(c.total_claimed_amount ?? data.claimedAmount),
          status: c.status || 'under_review',
          riskScore: Number(c.risk_score ?? 0),
          riskLevel: c.risk_priority || 'low',
          createdAt: c.created_at || new Date().toISOString(),
          updatedAt: c.updated_at || new Date().toISOString(),
          lineItems: (c.line_items || []).map((l: any, i: number) => ({
            id: l.id || `li-${i}`,
            serviceDescription: l.service_description,
            billingCode: l.billing_code,
            quantity: l.quantity,
            unitAmount: Number(l.unit_amount),
            totalAmount: Number(l.line_total),
          })),
          documents: [],
          timeline: [
            {
              id: 'ev-1',
              claimId: c.id,
              timestamp: new Date().toISOString(),
              status: c.status || 'under_review',
              title: 'Claim Submitted & Evaluated',
              description: `Claim submitted, screened by risk engine (${c.risk_priority || 'LOW'} risk), and queued for investigator review.`,
            },
          ],
        };
        // Keep fallback caches synchronized as well
        mockClaims.unshift(mappedClaim);
        const queueItem: ClaimQueueItem = {
          id: mappedClaim.id,
          referenceNumber: mappedClaim.referenceNumber,
          patientName: mappedClaim.patientName,
          providerName: mappedClaim.providerName,
          treatmentDate: mappedClaim.treatmentDate,
          claimedAmount: mappedClaim.claimedAmount,
          riskScore: mappedClaim.riskScore || 0,
          riskLevel: (mappedClaim.riskLevel || 'low') as any,
          rulesTriggered: 0,
          isDuplicate: false,
          daysWaiting: 0,
          status: mappedClaim.status,
          createdAt: mappedClaim.createdAt,
        };
        mockInvestigatorDashboard.recentHighPriorityClaims.unshift(queueItem);
        return { data: mappedClaim };
      },
      () => {
        const newClaim: Claim = {
          id: 'clm-' + Math.floor(1000 + Math.random() * 9000),
          referenceNumber: `CLM-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
          patientId: 'usr-pat-01',
          patientName: data.patientName || data.patient_name || 'Patient',
          policyNumber: data.policyNumber,
          memberReference: data.memberReference,
          providerName: data.providerName,
          treatmentDate: data.treatmentDate,
          admissionDate: data.admissionDate,
          dischargeDate: data.dischargeDate,
          treatmentDescription: data.treatmentDescription,
          billingCodes: data.billingCodes || ['CPT-99214'],
          invoiceNumber: data.invoiceNumber,
          claimedAmount: data.claimedAmount,
          status: 'under_review',
          riskScore: 35,
          riskLevel: 'medium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lineItems: data.lineItems.map((l, i) => ({ id: `li-${i + 1}`, ...l })),
          documents: [],
          timeline: [
            {
              id: 'ev-1',
              claimId: 'clm-new',
              timestamp: new Date().toISOString(),
              status: 'under_review',
              title: 'Claim Submitted & Queued',
              description: 'Patient submitted claim; automated screening complete and queued for investigator review.',
            },
          ],
        };
        mockClaims.unshift(newClaim);
        const queueItem: ClaimQueueItem = {
          id: newClaim.id,
          referenceNumber: newClaim.referenceNumber,
          patientName: newClaim.patientName,
          providerName: newClaim.providerName,
          treatmentDate: newClaim.treatmentDate,
          claimedAmount: newClaim.claimedAmount,
          riskScore: 35,
          riskLevel: 'medium',
          rulesTriggered: 1,
          isDuplicate: false,
          daysWaiting: 0,
          status: 'under_review',
          createdAt: newClaim.createdAt,
        };
        mockInvestigatorDashboard.recentHighPriorityClaims.unshift(queueItem);
        return newClaim;
      }
    );
  },

  async getNotifications(params?: PaginationParams): Promise<PaginatedResponse<any>> {
    return executeApiCall(
      () => apiClient.get('/patient/notifications', { params }),
      () => ({
        items: [
          { id: 'notif-1', title: 'Claim Approved', message: 'Your claim CLM-2026-88102 for Apollo Hospitals has been approved.', type: 'success', isRead: false, claimId: 'clm-1', createdAt: '2026-10-10T14:30:00Z' },
          { id: 'notif-2', title: 'Document Required', message: 'Investigator requested Discharge Summary for claim CLM-2026-55419.', type: 'warning', isRead: false, claimId: 'clm-2', createdAt: '2026-10-12T09:15:00Z' },
          { id: 'notif-3', title: 'Claim Under Review', message: 'Claim CLM-2026-33921 is being assessed by the medical claims team.', type: 'info', isRead: true, claimId: 'clm-3', createdAt: '2026-10-08T11:20:00Z' },
        ],
        total: 3,
        page: 1,
        limit: 10,
        totalPages: 1,
      })
    );
  },

  async markNotificationRead(id: string): Promise<void> {
    return executeApiCall(
      () => apiClient.post(`/patient/notifications/${id}/read`),
      () => undefined
    );
  },

  async getDocuments(): Promise<Document[]> {
    return executeApiCall(
      () => apiClient.get('/patient/documents'),
      () => [
        { id: 'doc-1', claimId: 'clm-1', name: 'Apollo_Hospital_Final_Bill.pdf', documentType: 'hospital_invoice', fileUrl: '/mock/bill1.pdf', fileSize: 2450000, mimeType: 'application/pdf', uploadedAt: '2026-10-09T10:00:00Z', verified: true },
        { id: 'doc-2', claimId: 'clm-1', name: 'Discharge_Summary_Cardiology.pdf', documentType: 'discharge_summary', fileUrl: '/mock/summary1.pdf', fileSize: 1850000, mimeType: 'application/pdf', uploadedAt: '2026-10-09T10:05:00Z', verified: true },
        { id: 'doc-3', claimId: 'clm-2', name: 'Max_Healthcare_Invoice_Oct.pdf', documentType: 'hospital_invoice', fileUrl: '/mock/invoice2.pdf', fileSize: 3100000, mimeType: 'application/pdf', uploadedAt: '2026-10-11T16:20:00Z', verified: false },
        { id: 'doc-4', claimId: 'clm-3', name: 'Pharmacy_Bills_Bundle.jpg', documentType: 'medical_bills', fileUrl: '/mock/pharmacy.jpg', fileSize: 980000, mimeType: 'image/jpeg', uploadedAt: '2026-10-07T12:00:00Z', verified: true },
      ]
    );
  },

  async uploadDocument(claimId: string, file: File, documentType: string): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    return executeApiCall(
      () => apiClient.post(`/patient/claims/${claimId}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
      () => ({
        id: 'doc-' + Date.now(),
        claimId,
        name: file.name,
        documentType,
        fileUrl: URL.createObjectURL(file),
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        verified: false,
      })
    );
  },

  async fulfillDocumentRequest(requestId: string): Promise<void> {
    return executeApiCall(
      () => apiClient.post(`/patient/document-requests/${requestId}/fulfill`),
      () => undefined
    );
  },

  async getProfile(): Promise<PatientProfile> {
    return executeApiCall<PatientProfile>(
      async (): Promise<{ data: PatientProfile }> => {
        const [profileRes, policies] = await Promise.all([
          apiClient.get('/patient/profile'),
          patientAPI.getPolicies().catch(() => mockPolicies),
        ]);
        const p = profileRes.data || {};
        const userObj = p.user || {};
        const resolvedName = p.name || p.full_name || userObj.full_name || userObj.name || '';
        const resolvedEmail = p.email || userObj.email || '';
        return {
          data: {
            id: p.id || userObj.id || '',
            name: resolvedName,
            email: resolvedEmail,
            role: 'patient' as UserRole,
            phone: p.phone || userObj.phone || '',
            dateOfBirth: p.date_of_birth || p.dateOfBirth || '',
            address: p.address || userObj.address || '',
            policies,
          },
        };
      },
      () => ({
        ...mockUserProfile,
        policies: mockPolicies,
      })
    );
  },

  async updateProfile(data: Partial<PatientProfile>): Promise<PatientProfile> {
    return executeApiCall(
      async () => {
        const body = {
          name: data.name,
          full_name: data.name,
          phone: data.phone,
          address: data.address,
          date_of_birth: data.dateOfBirth,
        };
        const res = await apiClient.put('/patient/profile', body);
        const p = res.data || {};
        const userObj = p.user || {};
        const updatedName = data.name || p.name || p.full_name || userObj.full_name || '';
        const updatedEmail = p.email || userObj.email || data.email || '';
        const updatedPhone = data.phone || p.phone || userObj.phone;
        const updatedAddress = data.address || p.address || userObj.address;
        const updatedDob = data.dateOfBirth || p.date_of_birth;

        const updatedProfile: PatientProfile = {
          id: p.id || userObj.id || '',
          name: updatedName,
          email: updatedEmail,
          role: 'patient',
          phone: updatedPhone,
          dateOfBirth: updatedDob,
          address: updatedAddress,
          policies: data.policies || mockPolicies,
        };

        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('claimlens_user');
          if (stored) {
            try {
              const u = JSON.parse(stored);
              u.name = updatedName;
              u.full_name = updatedName;
              u.phone = updatedPhone;
              u.address = updatedAddress;
              localStorage.setItem('claimlens_user', JSON.stringify(u));
            } catch (e) {}
          }
        }

        return { data: updatedProfile };
      },
      () => {
        if (typeof window !== 'undefined' && data.name) {
          const stored = localStorage.getItem('claimlens_user');
          if (stored) {
            try {
              const u = JSON.parse(stored);
              u.name = data.name;
              localStorage.setItem('claimlens_user', JSON.stringify(u));
            } catch (e) {}
          }
        }
        return {
          ...mockUserProfile,
          ...data,
          policies: mockPolicies,
        };
      }
    );
  },

  async getPolicies(): Promise<Policy[]> {
    return executeApiCall(
      async () => {
        const res = await apiClient.get('/patient/policies');
        const list = res.data || [];
        if (Array.isArray(list) && list.length > 0) {
          const mapped: Policy[] = list.map((p: any) => ({
            id: p.id,
            patientId: p.patient_id,
            policyNumber: p.policy_number,
            memberReference: p.member_reference,
            insurerName: p.insurer_name,
            policyType: p.policy_type,
            validFrom: p.coverage_start,
            validTo: p.coverage_end,
            sumInsured: Number(p.max_coverage_amount || 1000000),
            remainingSum: Number(p.max_coverage_amount || 1000000),
            status: (p.is_active ? 'active' : 'expired') as any,
            copayPercentage: Number(p.copay_percentage ?? 10),
            deductibleAmount: Number(p.deductible_amount ?? 0),
            tpaName: p.tpa_name || 'Medi Assist Insurance TPA',
          }));
          return { data: mapped };
        }
        return { data: mockPolicies };
      },
      () => mockPolicies
    );
  },

  async createPolicy(data: PolicyData): Promise<Policy> {
    return executeApiCall(
      () => apiClient.post('/patient/policies', data),
      () => ({
        id: 'pol-' + Date.now(),
        patientId: 'usr-pat-01',
        ...data,
        remainingSum: data.sumInsured,
        status: 'active',
      })
    );
  },
};

export const investigatorAPI = {
  async getDashboard(): Promise<InvestigatorDashboard> {
    return executeApiCall(
      async () => {
        const [dashRes, claimsRes] = await Promise.all([
          apiClient.get('/investigator/dashboard'),
          apiClient.get('/investigator/claims', { params: { limit: 10 } }).catch(() => ({ data: { items: [] } })),
        ]);
        const d = dashRes.data || {};
        const claimsData = claimsRes.data?.items || claimsRes.data || [];

        const recentHighPriorityClaims: ClaimQueueItem[] = (Array.isArray(claimsData) ? claimsData : []).map((c: any) => ({
          id: c.id,
          referenceNumber: c.claim_reference || c.referenceNumber || 'CLM-XXXX',
          patientName: c.patient_name || c.patientName || 'Patient',
          providerName: c.provider_name || c.providerName || 'Healthcare Provider',
          treatmentDate: c.treatment_date || c.treatmentDate || '',
          claimedAmount: Number(c.total_claimed_amount ?? c.claimedAmount ?? 0),
          riskScore: Number(c.risk_score ?? c.riskScore ?? 0),
          riskLevel: (c.risk_priority || c.riskLevel || 'low') as any,
          rulesTriggered: Number(c.triggered_rule_count ?? c.rulesTriggered ?? 0),
          isDuplicate: Boolean(c.is_duplicate ?? c.isDuplicate ?? false),
          assignedTo: c.assigned_investigator_id || c.assignedTo,
          assignedToName: c.assigned_investigator_name || c.assignedToName,
          daysWaiting: Number(c.days_waiting ?? c.daysWaiting ?? 1),
          status: c.status || 'under_review',
          createdAt: c.created_at || c.createdAt || new Date().toISOString(),
        }));

        const mapped: InvestigatorDashboard = {
          totalClaimsReceived: Number(d.total_claims ?? d.totalClaimsReceived ?? 0),
          awaitingReview: Number(d.pending_review ?? d.awaitingReview ?? 0),
          highPriorityClaims: Number(d.high_critical_risk ?? d.highPriorityClaims ?? 0),
          potentialDuplicates: Number(d.detected_duplicates ?? d.potentialDuplicates ?? 0),
          billingInconsistencies: Number(d.billing_inconsistencies ?? d.billingInconsistencies ?? Math.round((d.total_claims || 10) * 0.15)),
          providerAnomalies: Number(d.provider_anomalies ?? d.providerAnomalies ?? Math.round((d.total_claims || 10) * 0.08)),
          avgReviewTimeHours: Number(d.avg_review_time_hours ?? d.avgReviewTimeHours ?? 14.5),
          investigationBacklog: Number(d.pending_review ?? d.investigationBacklog ?? 12),
          amountUnderInvestigation: Number(d.flagged_amount ?? d.amountUnderInvestigation ?? 0),
          totalApprovedAmount: Number(d.approved_amount ?? d.totalApprovedAmount ?? 0),
          totalSettledAmount: Number(d.approved_amount ?? d.totalSettledAmount ?? 0),
          duplicateExposure: Number(d.detected_duplicates ? d.detected_duplicates * 45000 : (d.duplicateExposure ?? 270000)),
          recentHighPriorityClaims: recentHighPriorityClaims.length > 0 ? recentHighPriorityClaims : mockInvestigatorDashboard.recentHighPriorityClaims,
        };
        return { data: mapped };
      },
      () => mockInvestigatorDashboard
    );
  },

  async getClaims(params?: ClaimQueueParams): Promise<PaginatedResponse<ClaimQueueItem>> {
    return executeApiCall(
      async () => {
        const queryParams: any = {};
        const p = params?.page || 1;
        const lim = params?.limit || 20;
        queryParams.page = p;
        queryParams.page_size = lim;
        queryParams.skip = (p - 1) * lim;
        queryParams.limit = lim;
        if (params?.status && params.status !== 'all') queryParams.status = params.status;
        if (params?.riskLevel && params.riskLevel !== 'all') queryParams.risk_priority = params.riskLevel;
        if (params?.queueType) queryParams.queue_type = params.queueType;
        if (params?.search) queryParams.search = params.search;
        if (params?.sortBy) {
          if (params.sortBy === 'riskScore') {
            queryParams.sort_by = params.sortOrder === 'asc' ? 'risk_score_asc' : 'risk_score_desc';
          } else if (params.sortBy === 'amount') {
            queryParams.sort_by = params.sortOrder === 'asc' ? 'amount_asc' : 'amount_desc';
          } else if (params.sortBy === 'date') {
            queryParams.sort_by = params.sortOrder === 'asc' ? 'date_asc' : 'date_desc';
          }
        }

        const res = await apiClient.get('/investigator/claims', { params: queryParams });
        const rawItems = res.data?.items || (Array.isArray(res.data) ? res.data : []);
        const items: ClaimQueueItem[] = rawItems.map((c: any) => ({
          id: c.id,
          referenceNumber: c.claim_reference || c.referenceNumber || 'CLM-XXXX',
          patientName: c.patient_name || c.patientName || 'Patient',
          providerName: c.provider_name || c.providerName || 'Healthcare Provider',
          treatmentDate: c.treatment_date || c.treatmentDate || '',
          claimedAmount: Number(c.total_claimed_amount ?? c.claimedAmount ?? 0),
          riskScore: Number(c.risk_score ?? c.riskScore ?? 0),
          riskLevel: (c.risk_priority || c.riskLevel || 'low') as any,
          rulesTriggered: Number(c.triggered_rule_count ?? c.rulesTriggered ?? 0),
          isDuplicate: Boolean(c.is_duplicate ?? c.isDuplicate ?? false),
          assignedTo: c.assigned_investigator_id || c.assignedTo,
          assignedToName: c.assigned_investigator_name || c.assignedToName,
          daysWaiting: Number(c.days_waiting ?? c.daysWaiting ?? 1),
          status: c.status || 'under_review',
          createdAt: c.created_at || c.createdAt || new Date().toISOString(),
        }));

        return {
          data: {
            items,
            total: res.data?.total ?? items.length,
            page: p,
            limit: lim,
            totalPages: Math.ceil((res.data?.total ?? items.length) / lim) || 1,
          },
        };
      },
      () => {
        // Collect items from both dashboard queue and mockClaims
        const combinedMap = new Map<string, ClaimQueueItem>();
        for (const item of mockInvestigatorDashboard.recentHighPriorityClaims) {
          combinedMap.set(item.id, item);
        }
        for (const c of mockClaims) {
          if (!combinedMap.has(c.id)) {
            combinedMap.set(c.id, {
              id: c.id,
              referenceNumber: c.referenceNumber,
              patientName: c.patientName,
              providerName: c.providerName,
              treatmentDate: c.treatmentDate,
              claimedAmount: c.claimedAmount,
              riskScore: c.riskScore || 25,
              riskLevel: (c.riskLevel || 'low') as any,
              rulesTriggered: 0,
              isDuplicate: false,
              daysWaiting: 0,
              status: c.status,
              createdAt: c.createdAt,
            });
          }
        }

        let items = Array.from(combinedMap.values());
        if (params?.queueType === 'flagged') {
          items = items.filter(c => c.riskScore >= 50 || c.status === 'under_review');
        }
        if (params?.search) {
          const q = params.search.toLowerCase();
          items = items.filter(c => c.referenceNumber.toLowerCase().includes(q) || c.patientName.toLowerCase().includes(q) || c.providerName.toLowerCase().includes(q));
        }
        if (params?.riskLevel && params.riskLevel !== 'all') {
          items = items.filter(c => c.riskLevel.toLowerCase() === params.riskLevel?.toLowerCase());
        }
        if (params?.status && params.status !== 'all') {
          items = items.filter(c => c.status === params.status);
        }

        const sortOrder = params?.sortOrder || 'desc';
        if (params?.sortBy === 'date') {
          items.sort((a, b) => sortOrder === 'asc' ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (params?.sortBy === 'amount') {
          items.sort((a, b) => sortOrder === 'asc' ? a.claimedAmount - b.claimedAmount : b.claimedAmount - a.claimedAmount);
        } else {
          items.sort((a, b) => sortOrder === 'asc' ? a.riskScore - b.riskScore : b.riskScore - a.riskScore);
        }

        const page = params?.page || 1;
        const limit = params?.limit || 20;
        const start = (page - 1) * limit;
        return {
          items: items.slice(start, start + limit),
          total: items.length,
          page,
          limit,
          totalPages: Math.ceil(items.length / limit) || 1,
        };
      }
    );
  },

  async getClaim(id: string): Promise<InvestigatorClaimDetail> {
    return executeApiCall(
      async () => {
        const res = await apiClient.get(`/investigator/claims/${id}`);
        return { data: mapBackendInvestigatorClaim(res.data) };
      },
      () => ({
        ...mockInvestigatorClaimDetail,
        id,
      })
    );
  },

  async assignClaim(claimId: string, investigatorId: string): Promise<void> {
    return executeApiCall(
      () => apiClient.post(`/investigator/claims/${claimId}/assign`, { investigatorId }),
      () => undefined
    );
  },

  async addNote(claimId: string, content: string, isPrivate: boolean): Promise<Note> {
    return executeApiCall(
      () => apiClient.post(`/investigator/claims/${claimId}/notes`, { content, isPrivate }),
      () => ({
        id: 'note-' + Date.now(),
        claimId,
        authorId: 'usr-inv-01',
        authorName: 'Dr. Rajesh Kumar',
        content,
        isPrivate,
        createdAt: new Date().toISOString(),
      })
    );
  },

  async getNotes(claimId: string): Promise<Note[]> {
    return executeApiCall(
      () => apiClient.get(`/investigator/claims/${claimId}/notes`),
      () => mockInvestigatorClaimDetail.investigatorNotes || []
    );
  },

  async requestDocuments(claimId: string, data: DocRequestData): Promise<void> {
    return executeApiCall(
      () => apiClient.post(`/investigator/claims/${claimId}/request-documents`, data),
      () => undefined
    );
  },

  async makeDecision(claimId: string, data: DecisionData): Promise<void> {
    return executeApiCall(
      () => apiClient.post(`/investigator/claims/${claimId}/decision`, {
        decision: data.decision,
        reason: data.reason,
        notes: data.notes,
        approved_amount: data.approvedAmount,
        approvedAmount: data.approvedAmount,
      }),
      () => undefined
    );
  },
  async rescreenClaim(claimId: string): Promise<RiskAssessment> {
    return executeApiCall(
      async () => {
        const res = await apiClient.post(
          `/investigator/claims/${claimId}/rescreen`
        );

        return {
          data: mapBackendRiskAssessment(res.data, claimId),
        };
      },
      () => mockInvestigatorClaimDetail.riskAssessment!
    );
  },
  async getDuplicates(): Promise<DuplicateMatch[]> {
    return executeApiCall(
      () => apiClient.get('/investigator/duplicates'),
      () => mockDuplicates
    );
  },
  async resolveDuplicate(duplicateId: string, status: string, notes?: string): Promise<void> {
    return executeApiCall(
      () => apiClient.post(`/investigator/duplicates/${duplicateId}/resolve`, { status, notes }),
      () => undefined
    );
  },
  async getClaimDuplicates(claimId: string): Promise<DuplicateMatch[]> {
    return executeApiCall(
      () => apiClient.get(`/investigator/claims/${claimId}/duplicates`),
      () => mockDuplicates.filter(d => d.claim1Id === claimId || d.claim2Id === claimId)
    );
  },
  async markFalsePositive(findingId: string, reason: string): Promise<void> {
    return executeApiCall(
      () => apiClient.post(`/investigator/findings/${findingId}/false-positive`, { reason }),
      () => undefined
    );
  },
  async getAuditLogs(params?: AuditLogParams): Promise<PaginatedResponse<AuditLog>> {
    return executeApiCall(
      () => apiClient.get('/investigator/audit-logs', { params }),
      () => {
        let items = [...mockAuditLogs];
        if (params?.actor) {
          items = items.filter(l => l.actorName.toLowerCase().includes(params.actor!.toLowerCase()));
        }
        if (params?.action) {
          items = items.filter(l => l.action.toLowerCase().includes(params.action!.toLowerCase()));
        }
        const page = params?.page || 1;
        const limit = params?.limit || 15;
        const start = (page - 1) * limit;
        return {
          items: items.slice(start, start + limit),
          total: items.length,
          page,
          limit,
          totalPages: Math.ceil(items.length / limit) || 1,
        };
      }
    );
  },
};

export const analyticsAPI = {
  async getDashboardData(params?: AnalyticsParams): Promise<DashboardCharts> {
    return executeApiCall(
      async () => {
        const res = await apiClient.get('/analytics/investigator-dashboard', { params });
        const d = res.data || {};

        const timeSeries: TimeSeriesData[] = (d.claims_over_time || []).map((t: any) => ({
          date: t.date,
          claimsCount: t.count,
          flaggedCount: Math.round(t.count * 0.25),
          amount: Number(t.total_amount || 0),
        }));

        const statusColors: Record<string, string> = {
          approved: '#14b8a6',
          under_review: '#f59e0b',
          settled: '#10b981',
          rejected: '#ef4444',
          documentation_requested: '#f97316',
          risk_screening: '#8b5cf6',
          validation: '#6366f1',
          submitted: '#3b82f6',
          payment_processing: '#06b6d4',
          partially_approved: '#0d9488',
        };
        const totalStatusClaims = (d.claims_by_status || []).reduce((acc: number, curr: any) => acc + (curr.count || 0), 0) || 1;
        const statusDistribution: StatusData[] = (d.claims_by_status || []).map((s: any) => ({
          status: s.status,
          count: s.count,
          percentage: Math.round(((s.count || 0) / totalStatusClaims) * 100),
          fill: statusColors[s.status] || '#1e3a8a',
        }));

        const riskColors: Record<string, string> = {
          low: '#10b981',
          medium: '#eab308',
          high: '#f97316',
          critical: '#ef4444',
        };
        const riskDistribution: RiskData[] = (d.risk_distribution || []).map((r: any) => ({
          range: (r.priority || 'LOW').toUpperCase(),
          count: r.count,
          level: (r.priority || 'low') as any,
          fill: riskColors[(r.priority || 'low').toLowerCase()] || '#10b981',
        }));

        return {
          data: {
            ...mockAnalyticsDashboard,
            timeSeries: timeSeries.length > 0 ? timeSeries : mockAnalyticsDashboard.timeSeries,
            statusDistribution: statusDistribution.length > 0 ? statusDistribution : mockAnalyticsDashboard.statusDistribution,
            riskDistribution: riskDistribution.length > 0 ? riskDistribution : mockAnalyticsDashboard.riskDistribution,
          },
        };
      },
      () => mockAnalyticsDashboard
    );
  },

  async getClaimsOverTime(params?: AnalyticsParams): Promise<TimeSeriesData[]> {
    return executeApiCall(
      () => apiClient.get('/analytics/claims-over-time', { params }),
      () => mockAnalyticsDashboard.timeSeries
    );
  },

  async getClaimsByStatus(params?: AnalyticsParams): Promise<StatusData[]> {
    return executeApiCall(
      () => apiClient.get('/analytics/claims-by-status', { params }),
      () => mockAnalyticsDashboard.statusDistribution
    );
  },

  async getRiskDistribution(params?: AnalyticsParams): Promise<RiskData[]> {
    return executeApiCall(
      () => apiClient.get('/analytics/risk-distribution', { params }),
      () => mockAnalyticsDashboard.riskDistribution
    );
  },

  async getFindingsByRule(params?: AnalyticsParams): Promise<RuleData[]> {
    return executeApiCall(
      () => apiClient.get('/analytics/findings-by-rule', { params }),
      () => mockAnalyticsDashboard.topRules
    );
  },

  async getClaimsByProvider(params?: AnalyticsParams): Promise<ProviderData[]> {
    return executeApiCall(
      () => apiClient.get('/analytics/claims-by-provider', { params }),
      () => mockAnalyticsDashboard.providerSummary
    );
  },

  async getAmountsSummary(params?: AnalyticsParams): Promise<AmountData[]> {
    return executeApiCall(
      () => apiClient.get('/analytics/amounts-summary', { params }),
      () => mockAnalyticsDashboard.amountComparison
    );
  },

  async getDuplicateExposure(params?: AnalyticsParams): Promise<DuplicateExposureData[]> {
    return executeApiCall(
      () => apiClient.get('/analytics/duplicate-exposure', { params }),
      () => mockAnalyticsDashboard.duplicateExposure
    );
  },

  async exportCSV(params?: AnalyticsParams): Promise<Blob> {
    try {
      const res = await apiClient.get('/analytics/export-csv', { params, responseType: 'blob' });
      return res.data;
    } catch {
      const csv = 'ClaimReference,Patient,Provider,Date,Amount,RiskScore,Status\nCLM-2026-88102,Priya Sharma,Apollo Hospitals,2026-10-09,185000,12,approved\nCLM-2026-55419,Rahul Verma,Max Healthcare,2026-10-11,245000,84,under_review';
      return new Blob([csv], { type: 'text/csv' });
    }
  },
};
