import { useCallback, useEffect, useMemo, useState } from 'react';
import { CURRENT_USER } from '../config/app';
import { toOpportunityViews } from '../lib/attention';
import { fetchDashboardSnapshot } from '../services/dashboardService';
import type {
  ActivityEvent,
  DashboardSnapshot,
  NewActivityInput,
  NewOpportunityInput,
  NewTaskInput,
  Opportunity,
  OpportunityView,
  TaskItem,
} from '../types';

export type CrmActionModal = 'opportunity' | 'task' | 'activity' | 'import' | null;

export interface DashboardData {
  isLoading: boolean;
  error: Error | null;
  snapshot: DashboardSnapshot | null;
  opportunities: OpportunityView[];
  opportunitiesById: Map<string, OpportunityView>;
  activeModal: CrmActionModal;
  openModal: (modal: Exclude<CrmActionModal, null>) => void;
  closeModal: () => void;
  addOpportunity: (input: NewOpportunityInput) => Opportunity;
  addTask: (input: NewTaskInput) => TaskItem;
  addActivity: (input: NewActivityInput) => ActivityEvent;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Loads the CRM snapshot and exposes in-memory mutations so every module
 * can create records without a backend. Point `fetchDashboardSnapshot` at an
 * API later — mutations can then call write endpoints instead of setState.
 */
export function useDashboardData(): DashboardData {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<CrmActionModal>(null);

  useEffect(() => {
    let cancelled = false;

    fetchDashboardSnapshot()
      .then((result) => {
        if (cancelled) return;
        setSnapshot(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause : new Error('Unable to load CRM data'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const opportunities = useMemo(
    () => (snapshot ? toOpportunityViews(snapshot.opportunities) : []),
    [snapshot],
  );

  const opportunitiesById = useMemo(
    () => new Map(opportunities.map((opportunity) => [opportunity.id, opportunity])),
    [opportunities],
  );

  const openModal = useCallback((modal: Exclude<CrmActionModal, null>) => {
    setActiveModal(modal);
  }, []);

  const closeModal = useCallback(() => setActiveModal(null), []);

  const addOpportunity = useCallback((input: NewOpportunityInput) => {
    const record: Opportunity = {
      id: createId('opp'),
      projectName: input.projectName.trim(),
      entityName: input.entityName.trim(),
      type: input.type,
      status: input.status,
      stage: input.stage,
      dealLead: input.dealLead.trim() || null,
      sourceType: input.sourceType,
      sourceName: input.sourceName.trim() || 'Internal',
      specialty: input.specialty.trim() || 'Specialty',
      geography: input.geography.trim() || 'National',
      nwp: input.nwp,
      netRevenue: input.netRevenue,
      pfEbitda: input.pfEbitda,
      nextAction: input.nextAction.trim() || null,
      nextActionDate: input.nextActionDate || null,
      priority: input.priority,
      lastActivityDate: new Date().toISOString(),
    };

    setSnapshot((current) => {
      if (!current) return current;
      const activity: ActivityEvent = {
        id: createId('act'),
        kind: 'status_change',
        description: `${CURRENT_USER.firstName} ${CURRENT_USER.lastName} created ${record.projectName}`,
        actor: `${CURRENT_USER.firstName} ${CURRENT_USER.lastName}`,
        opportunityId: record.id,
        timestamp: new Date().toISOString(),
      };
      return {
        ...current,
        opportunities: [record, ...current.opportunities],
        activity: [activity, ...current.activity],
        generatedAt: new Date().toISOString(),
      };
    });

    return record;
  }, []);

  const addTask = useCallback((input: NewTaskInput) => {
    const record: TaskItem = {
      id: createId('task'),
      priority: input.priority,
      action: input.action.trim(),
      opportunityId: input.opportunityId,
      owner: input.owner.trim(),
      dueDate: input.dueDate,
    };

    setSnapshot((current) => {
      if (!current) return current;
      const project = current.opportunities.find((item) => item.id === record.opportunityId);
      const activity: ActivityEvent = {
        id: createId('act'),
        kind: 'task',
        description: `${record.owner} added a task on ${project?.projectName ?? 'a project'}`,
        actor: record.owner,
        opportunityId: record.opportunityId,
        timestamp: new Date().toISOString(),
      };
      return {
        ...current,
        tasks: [record, ...current.tasks],
        activity: [activity, ...current.activity],
        generatedAt: new Date().toISOString(),
      };
    });

    return record;
  }, []);

  const addActivity = useCallback((input: NewActivityInput) => {
    const record: ActivityEvent = {
      id: createId('act'),
      kind: input.kind,
      description: input.description.trim(),
      actor: input.actor.trim(),
      opportunityId: input.opportunityId,
      timestamp: new Date().toISOString(),
    };

    setSnapshot((current) => {
      if (!current) return current;
      return {
        ...current,
        activity: [record, ...current.activity],
        opportunities: current.opportunities.map((opportunity) =>
          opportunity.id === record.opportunityId
            ? { ...opportunity, lastActivityDate: record.timestamp }
            : opportunity,
        ),
        generatedAt: new Date().toISOString(),
      };
    });

    return record;
  }, []);

  return {
    isLoading,
    error,
    snapshot,
    opportunities,
    opportunitiesById,
    activeModal,
    openModal,
    closeModal,
    addOpportunity,
    addTask,
    addActivity,
  };
}
