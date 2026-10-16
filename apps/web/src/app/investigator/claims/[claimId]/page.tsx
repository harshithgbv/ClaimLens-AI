'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldAlert,
  Flame,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Copy,
  Clock,
  RotateCcw,
  Send,
  Lock,
  User,
  Scale,
  Download,
  Eye,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { investigatorAPI } from '@/lib/api';
import {
  InvestigatorClaimDetail,
  RiskAssessment,
  Finding,
  Note,
  DecisionData,
} from '@/types';
import { RiskScoreBadge } from '@/components/shared/RiskScoreBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatDateTime, formatINR } from '@/lib/utils';

export default function InvestigatorClaimDetailPage() {
  const params = useParams();
  const router = useRouter();
  const claimId = params.claimId as string;
  const { toast } = useToast();

  const [claim, setClaim] = useState<InvestigatorClaimDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isNotePrivate, setIsNotePrivate] = useState(true);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Rescreen state
  const [isRescreening, setIsRescreening] = useState(false);

  // False positive dialog
  const [falsePositiveFindingId, setFalsePositiveFindingId] = useState<string | null>(null);
  const [falsePositiveReason, setFalsePositiveReason] = useState('');

  // Request Document modal
  const [showDocRequestModal, setShowDocRequestModal] = useState(false);
  const [requestedDocTypes, setRequestedDocTypes] = useState<string[]>(['discharge_summary']);
  const [docRequestMessage, setDocRequestMessage] = useState('');

  // Decision Modal
  const [activeDecision, setActiveDecision] = useState<
    'approve' | 'partially_approve' | 'reject' | 'request_verification' | 'escalate' | null
  >(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [partialApprovedAmount, setPartialApprovedAmount] = useState<number>(0);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const fetchDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await investigatorAPI.getClaim(claimId);
      setClaim(data);
      if (data.claimedAmount) {
        setPartialApprovedAmount(Math.round(data.claimedAmount * 0.8));
      }
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve claim investigation details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [claimId]);

  // Rescreen claim handler
  const handleRescreen = async () => {
    setIsRescreening(true);
    try {
      const updatedAssessment = await investigatorAPI.rescreenClaim(claimId);
      setClaim((prev) => (prev ? { ...prev, riskAssessment: updatedAssessment } : null));
      toast({
        title: 'Rescreening Complete',
        description: `Risk score recalculation finished (${updatedAssessment.riskScore}/100).`,
        type: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Rescreen failed',
        description: err.message,
        type: 'error',
      });
    } finally {
      setIsRescreening(false);
    }
  };

  // Add Note handler
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setIsSubmittingNote(true);
    try {
      const note = await investigatorAPI.addNote(claimId, newNoteContent, isNotePrivate);
      setClaim((prev) =>
        prev
          ? {
              ...prev,
              investigatorNotes: [note, ...(prev.investigatorNotes || [])],
            }
          : null
      );
      setNewNoteContent('');
      toast({
        title: 'Note recorded',
        description: isNotePrivate ? 'Saved as private investigator note.' : 'Saved as shared audit note.',
        type: 'info',
      });
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Mark False Positive
  // Mark False Positive
  const handleConfirmFalsePositive = async () => {
    if (!falsePositiveFindingId || !falsePositiveReason.trim()) return;

    try {
      await investigatorAPI.markFalsePositive(
        falsePositiveFindingId,
        falsePositiveReason
      );

      await fetchDetail();

      toast({
        title: 'Marked as False Positive',
        description: 'Anomaly cleared and logged in system compliance audit.',
        type: 'success',
      });

      setFalsePositiveFindingId(null);
      setFalsePositiveReason('');
    } catch (err: any) {
      toast({
        title: 'Action failed',
        description: err.message,
        type: 'error',
      });
    }
  };

  // Submit Document Request
  const handleSubmitDocRequest = async () => {
    if (requestedDocTypes.length === 0 || !docRequestMessage.trim()) {
      toast({
        title: 'Incomplete Request',
        description: 'Select document types and enter a note for the policyholder.',
        type: 'error',
      });
      return;
    }

    try {
      await investigatorAPI.requestDocuments(claimId, {
        documentTypes: requestedDocTypes,
        message: docRequestMessage,
      });
      toast({
        title: 'Document Request Transmitted',
        description: 'Policyholder has been notified via portal notification.',
        type: 'success',
      });
      setShowDocRequestModal(false);
      fetchDetail();
    } catch (err: any) {
      toast({ title: 'Request failed', description: err.message, type: 'error' });
    }
  };

  // Make Decision
  const handleExecuteDecision = async () => {
    if (!activeDecision || !decisionReason.trim()) {
      toast({
        title: 'Justification Required',
        description: 'Every claims decision requires an explicit clinical justification.',
        type: 'error',
      });
      return;
    }

    setIsSubmittingDecision(true);
    try {
      const payload: DecisionData = {
        decision: activeDecision,
        reason: decisionReason,
        approvedAmount:
          activeDecision === 'partially_approve'
            ? partialApprovedAmount
            : activeDecision === 'approve'
            ? claim?.claimedAmount
            : activeDecision === 'reject'
            ? 0
            : undefined,
      };

      await investigatorAPI.makeDecision(claimId, payload);
      toast({
        title: `Claim ${activeDecision.replace(/_/g, ' ').toUpperCase()}`,
        description: 'Decision committed to ledger and patient notified.',
        type: 'success',
      });
      setActiveDecision(null);
      fetchDetail();
    } catch (err: any) {
      toast({ title: 'Decision Failed', description: err.message, type: 'error' });
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading claim investigation workspace..." />;
  }

  if (error || !claim) {
    return (
      <ErrorState
        title="Investigation File Error"
        message={error || 'Could not load claim'}
        onRetry={fetchDetail}
      />
    );
  }

  const risk = claim.riskAssessment;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link href="/investigator/claims">
            <Button variant="outline" size="icon" className="h-9 w-9 border-slate-300">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-navy-950 font-mono">
                {claim.referenceNumber}
              </h1>
              <StatusBadge status={claim.status} size="md" />
              {risk && (
                <RiskScoreBadge score={risk.riskScore} priority={risk.priority} size="sm" />
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Assigned to: <span className="font-semibold text-slate-800">{claim.assignedToName || 'Unassigned'}</span> • Submitted {formatDate(claim.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-2xs text-slate-500 block uppercase font-bold">Gross Claim</span>
            <span className="text-xl font-mono font-extrabold text-navy-950">
              {formatINR(claim.claimedAmount)}
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleRescreen}
            isLoading={isRescreening}
            variant="outline"
            className="border-slate-300 text-slate-700 gap-1.5 text-xs h-9"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Rescreen AI
          </Button>
        </div>
      </div>

      {/* Main Workspace 60 / 40 Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: 60% (7 cols on 12-col grid) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Claim Summary & Policy Details */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900">
                Patient & Policy Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Patient Name</span>
                  <span className="font-bold text-slate-900 text-sm">{claim.patientName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Patient Phone</span>
                  <span className="text-slate-700">{claim.patientPhone || '+91 98765 43210'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Policy Number</span>
                  <span className="font-mono font-bold text-navy-900">{claim.policyNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Member ID</span>
                  <span className="font-mono text-slate-800">{claim.memberReference}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">TPA Administrator</span>
                  <span className="font-semibold text-slate-800">{claim.tpaName || 'In-House TPA Desk'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Coverage Plan</span>
                  <span className="text-slate-800">{claim.policyType || 'Comprehensive Health Shield'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Co-pay & Deductible</span>
                  <span className="font-semibold text-slate-800">
                    {claim.copayPercentage !== undefined ? `${claim.copayPercentage}%` : '0%'} | {formatINR(claim.deductibleAmount || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Total Sum Insured</span>
                  <span className="font-mono font-bold text-slate-900">
                    {claim.sumInsured ? formatINR(claim.sumInsured) : '₹10,00,000'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Approved Payout</span>
                  <span className={`font-mono font-bold ${claim.status === 'rejected' ? 'text-rose-700' : 'text-teal-700'}`}>
                    {claim.status === 'rejected'
                      ? '₹0.00 (Rejected)'
                      : claim.approvedAmount !== undefined && claim.approvedAmount !== null
                      ? formatINR(claim.approvedAmount)
                      : 'Pending Review'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Treatment & Provider Details */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900">
                Treatment & Hospital Invoice
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Hospital / Provider</span>
                  <span className="font-semibold text-slate-900">{claim.providerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Invoice Number</span>
                  <span className="font-mono font-bold text-navy-900">{claim.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Treatment Date</span>
                  <span className="text-slate-800">{formatDate(claim.treatmentDate)}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="font-semibold text-slate-700 block mb-1">Diagnosis & Clinical Indication:</span>
                <p className="text-slate-800 leading-relaxed">{claim.treatmentDescription}</p>
                {claim.billingCodes && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {claim.billingCodes.map((c, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-2xs">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Line Items Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Itemized Charges
                </h4>
                <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-3">Service / Description</th>
                        <th className="p-3">Code</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Rate</th>
                        <th className="p-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {claim.lineItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-medium text-slate-900">{item.serviceDescription}</td>
                          <td className="p-3 font-mono text-slate-500">{item.billingCode || '-'}</td>
                          <td className="p-3 text-right">{item.quantity}</td>
                          <td className="p-3 text-right font-mono">{formatINR(item.unitAmount)}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {formatINR(item.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td colSpan={4} className="p-3 text-right text-slate-600 uppercase text-2xs">
                          Gross Total
                        </td>
                        <td className="p-3 text-right font-mono text-navy-950">
                          {formatINR(claim.claimedAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents Section */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Supporting Bills & Medical Records
                </CardTitle>
                <CardDescription className="text-xs">
                  Attachments submitted for forensic OCR
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDocRequestModal(true)}
                className="text-xs border-teal-300 text-teal-800 hover:bg-teal-50"
              >
                Request More Documents
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {claim.documents.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No document attachments found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {claim.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-7 w-7 text-navy-700 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{doc.name}</p>
                          <p className="text-2xs text-slate-500 capitalize">
                            {doc.documentType.replace(/_/g, ' ')} • {(doc.fileSize / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Duplicate Matches Side-by-Side Comparison (if any) */}
          {claim.duplicateMatches && claim.duplicateMatches.length > 0 && (
            <Card className="border-rose-200 bg-rose-50/20 shadow-xs">
              <CardHeader className="pb-3 border-b border-rose-100">
                <div className="flex items-center gap-2">
                  <Copy className="h-5 w-5 text-rose-600" />
                  <CardTitle className="text-base font-bold text-rose-950">
                    Duplicate Match Cross-Registry Comparison
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-rose-700">
                  Side-by-side comparison with matching claim in national health database
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {claim.duplicateMatches.map((dup) => (
                  <div key={dup.id} className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        Conflicting Record: <code className="text-rose-700 font-bold">{dup.claim2Reference}</code>
                      </span>
                      <span className="font-bold text-rose-800 px-2 py-0.5 rounded-full bg-rose-100 text-2xs">
                        {dup.similarityScore}% Similarity
                      </span>
                    </div>

                    <div className="rounded-xl border border-rose-200 bg-white overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-rose-50 text-rose-900 font-semibold border-b border-rose-200">
                          <tr>
                            <th className="p-2.5">Field</th>
                            <th className="p-2.5">Current Claim ({claim.referenceNumber})</th>
                            <th className="p-2.5">Conflicting Record ({dup.claim2Reference})</th>
                            <th className="p-2.5">Match Assessment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr className="bg-emerald-50/40">
                            <td className="p-2.5 font-medium text-slate-700">Provider Name</td>
                            <td className="p-2.5 text-slate-900 font-semibold">{claim.providerName}</td>
                            <td className="p-2.5 text-slate-900">{dup.providerName || claim.providerName}</td>
                            <td className="p-2.5 font-bold text-emerald-700">100% Match</td>
                          </tr>
                          <tr className="bg-emerald-50/40">
                            <td className="p-2.5 font-medium text-slate-700">Invoice Number</td>
                            <td className="p-2.5 font-mono text-slate-900 font-bold">{claim.invoiceNumber}</td>
                            <td className="p-2.5 font-mono text-slate-900">{claim.invoiceNumber}</td>
                            <td className="p-2.5 font-bold text-emerald-700">Identical Invoice</td>
                          </tr>
                          <tr className="bg-emerald-50/40">
                            <td className="p-2.5 font-medium text-slate-700">Claim Amount</td>
                            <td className="p-2.5 font-mono text-slate-900">{formatINR(claim.claimedAmount)}</td>
                            <td className="p-2.5 font-mono text-slate-900">{formatINR(dup.amount || claim.claimedAmount)}</td>
                            <td className="p-2.5 font-bold text-emerald-700">Exact Amount</td>
                          </tr>
                          <tr className="bg-amber-50/40">
                            <td className="p-2.5 font-medium text-slate-700">Policy / Insurer</td>
                            <td className="p-2.5 text-slate-900">{claim.policyNumber}</td>
                            <td className="p-2.5 text-slate-900 font-medium">HDFC-ERGO-LEGACY-01</td>
                            <td className="p-2.5 font-semibold text-amber-700">Different Policy ID</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Audit Trail Timeline */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900">
                Audit Trail & History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {(claim.auditLogs || []).map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-xs border-b border-slate-100 pb-2.5 last:border-0">
                    <div className="h-6 w-6 rounded-full bg-navy-50 text-navy-800 flex items-center justify-center font-bold text-2xs shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{log.action}</span>
                        <span className="text-2xs text-slate-400">{formatDateTime(log.timestamp)}</span>
                      </div>
                      <p className="text-slate-600 mt-0.5">{String(log.details)}</p>
                      <span className="text-2xs text-slate-400">Actor: {log.actorName} ({log.actorRole})</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: 40% (5 cols on 12-col grid) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Risk Assessment Gauge Card */}
          {risk && (
            <Card className="border-slate-200 shadow-md">
              <CardHeader className="pb-2 bg-gradient-to-r from-navy-900 to-navy-800 text-white rounded-t-xl">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold uppercase tracking-wider text-teal-300">
                    AI Risk Assessment
                  </span>
                  <span className="text-2xs text-slate-300">{formatDateTime(risk.assessedAt)}</span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold font-mono tracking-tight text-white">
                      {risk.riskScore}
                    </span>
                    <span className="text-sm text-navy-200 uppercase font-semibold">/ 100</span>
                  </div>
                  <RiskScoreBadge priority={risk.priority} size="md" />
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Triggered Rules ({risk.rulesTriggered}):</span>
                  <span className="text-2xs text-slate-500">Autonomous Anomaly Engine</span>
                </div>

                {/* Risk Findings List */}
                <div className="space-y-3">
                  {risk.findings.map((f) => (
                    <div
                      key={f.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                        f.isFalsePositive
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : f.severity === 'critical'
                          ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                          : 'bg-amber-50/60 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{f.ruleName}</span>
                        </div>
                        <span className="text-2xs font-bold uppercase px-1.5 py-0.5 rounded bg-white shadow-2xs font-mono">
                          +{f.scoreContribution} pts
                        </span>
                      </div>

                      <p className="text-slate-700 leading-relaxed text-xs">{f.explanation}</p>

                      {/* Evidence block */}
                      {f.evidence && Object.keys(f.evidence).length > 0 && (
                        <div className="p-2 rounded bg-white/80 border border-slate-200/80 font-mono text-2xs space-y-0.5 text-slate-700">
                          {Object.entries(f.evidence).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-slate-500 capitalize">{k}:</span>
                              <span className="font-semibold text-slate-900">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* False positive button or tag */}
                      <div className="pt-1 flex items-center justify-between">
                        {f.isFalsePositive ? (
                          <span className="text-2xs font-semibold text-emerald-700 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Cleared as False Positive
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setFalsePositiveFindingId(f.id)}
                            className="text-2xs text-navy-700 hover:text-navy-900 font-semibold underline"
                          >
                            Mark as False Positive
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Decision Panel */}
          <Card className="border-slate-300 shadow-md ring-1 ring-navy-900/5">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/70 rounded-t-xl">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900">
                  Investigator Adjudication
                </CardTitle>
                <StatusBadge status={claim.status} />
              </div>
              <CardDescription className="text-xs">
                Authorize payment or require verification
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Reassign Investigator</Label>
                <select
                  value={claim.assignedTo || 'usr-inv-01'}
                  onChange={async (e) => {
                    await investigatorAPI.assignClaim(claim.id, e.target.value);
                    toast({ title: 'Claim Reassigned', type: 'info' });
                    fetchDetail();
                  }}
                  className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800"
                >
                  <option value="usr-inv-01">Dr. Rajesh Kumar (Lead Medical Claims)</option>
                  <option value="usr-inv-02">Ananya Iyer (Senior Fraud Forensics)</option>
                  <option value="usr-inv-03">Suresh Menon (Clinical Auditor)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={() => setActiveDecision('approve')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve in Full
                </Button>

                <Button
                  size="sm"
                  onClick={() => setActiveDecision('partially_approve')}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs gap-1"
                >
                  <Scale className="h-3.5 w-3.5" />
                  Partial Approve
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDocRequestModal(true)}
                  className="border-amber-300 text-amber-800 hover:bg-amber-50 text-xs gap-1"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Request Proof
                </Button>

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setActiveDecision('reject')}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Deny / Reject
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Investigation Notes Component */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900">
                Investigation Notes & Diary
              </CardTitle>
              <CardDescription className="text-xs">
                Private notes and hospital communication logs
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  rows={3}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Record call with hospital billing desk, evidence analysis, or supervisor notes..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-navy-600 focus:outline-none"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isNotePrivate}
                      onChange={(e) => setIsNotePrivate(e.target.checked)}
                      className="rounded border-slate-300 text-navy-700 focus:ring-navy-600 h-3.5 w-3.5"
                    />
                    <Lock className="h-3 w-3 text-slate-400" />
                    <span>Private investigator note</span>
                  </label>

                  <Button
                    type="submit"
                    size="sm"
                    isLoading={isSubmittingNote}
                    className="bg-navy-800 hover:bg-navy-900 text-white text-xs h-8 px-3 gap-1"
                  >
                    <Send className="h-3 w-3" />
                    Add Note
                  </Button>
                </div>
              </form>

              {/* Notes List */}
              <div className="space-y-3 pt-2">
                {(claim.investigatorNotes || []).map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{note.authorName}</span>
                      <div className="flex items-center gap-1 text-2xs text-slate-400">
                        {note.isPrivate && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold flex items-center gap-0.5">
                            <Lock className="h-2.5 w-2.5" /> Private
                          </span>
                        )}
                        <span>{formatDateTime(note.createdAt)}</span>
                      </div>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{note.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* False Positive Reason Dialog */}
      <Dialog
        open={!!falsePositiveFindingId}
        onOpenChange={(open) => !open && setFalsePositiveFindingId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Finding as False Positive</DialogTitle>
            <DialogDescription>
              Explain why this detected anomaly is medically or contractually justified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="fpReason">Clinical Justification *</Label>
            <textarea
              id="fpReason"
              rows={3}
              value={falsePositiveReason}
              onChange={(e) => setFalsePositiveReason(e.target.value)}
              placeholder="e.g. Contractual agreement rider permits separate surcharge for weekend ICU admissions."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-navy-600 focus:outline-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFalsePositiveFindingId(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmFalsePositive} className="bg-teal-600 hover:bg-teal-700 text-white">
              Confirm False Positive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Documents Dialog */}
      <Dialog open={showDocRequestModal} onOpenChange={setShowDocRequestModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Verification Documents from Policyholder</DialogTitle>
            <DialogDescription>
              Select required documents. The policyholder will be notified with a direct upload form.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <Label className="text-xs">Document Types Required:</Label>
            <div className="space-y-2">
              {[
                { id: 'discharge_summary', label: 'Certified Hospital Discharge Summary' },
                { id: 'cath_lab_report', label: 'Catheterization Lab Telemetry & ECG Strips' },
                { id: 'detailed_pharmacy_bill', label: 'Itemized Pharmacy Batch Invoices' },
                { id: 'ot_notes', label: 'Surgeon Operation Theatre Notes' },
              ].map((doc) => (
                <label key={doc.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requestedDocTypes.includes(doc.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setRequestedDocTypes([...requestedDocTypes, doc.id]);
                      } else {
                        setRequestedDocTypes(requestedDocTypes.filter((t) => t !== doc.id));
                      }
                    }}
                    className="rounded border-slate-300 text-navy-700"
                  />
                  <span className="text-slate-800">{doc.label}</span>
                </label>
              ))}
            </div>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs">Patient Facing Message *</Label>
              <textarea
                rows={3}
                value={docRequestMessage}
                onChange={(e) => setDocRequestMessage(e.target.value)}
                placeholder="Explain clearly why these documents are required..."
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-navy-600 focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDocRequestModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmitDocRequest} className="bg-navy-800 hover:bg-navy-900 text-white">
              Send Document Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision Confirmation Modal */}
      <Dialog open={!!activeDecision} onOpenChange={(open) => !open && setActiveDecision(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">
              Confirm Decision: {activeDecision?.replace(/_/g, ' ')}
            </DialogTitle>
            <DialogDescription>
              This adjudication will be recorded with your credentials and sent to the billing clearinghouse.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {activeDecision === 'partially_approve' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Approved Amount (₹) *</Label>
                <Input
                  type="number"
                  value={partialApprovedAmount}
                  onChange={(e) => setPartialApprovedAmount(parseFloat(e.target.value) || 0)}
                  className="font-mono text-sm h-9"
                />
                <span className="text-2xs text-slate-500">
                  Total Claimed: {formatINR(claim.claimedAmount)}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Reason / Rationale (Audit Mandatory) *</Label>
              <textarea
                rows={3}
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="State clinical reasoning, tariff policy clauses, or unbundling deductions applied..."
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-navy-600 focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActiveDecision(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteDecision}
              isLoading={isSubmittingDecision}
              className={
                activeDecision === 'reject'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-navy-800 hover:bg-navy-900 text-white'
              }
            >
              Commit Decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
