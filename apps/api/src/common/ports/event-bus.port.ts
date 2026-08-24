// Port : le code métier publie ici, point. Le transport est un adaptateur.
export interface DomainEventMsg {
  eventId: string; type: string; tenantId: string;
  aggregateId: string; payload: unknown; occurredAt: string;
}
export abstract class EventBusPort {
  abstract publish(ev: DomainEventMsg): Promise<void>;
  abstract subscribe(type: string, handler: (ev: DomainEventMsg) => Promise<void>): void;
}

// Adaptateur 1 (MVP) : l'outbox EST le bus — publish = insert, le worker livre.
import { PrismaService } from "../prisma.service";
import { emitEvent } from "../domain-event";
export class OutboxEventBus extends EventBusPort {
  constructor(private prisma: PrismaService) { super(); }
  async publish(ev: DomainEventMsg) {
    await emitEvent(this.prisma, ev.tenantId, ev.type, ev.aggregateId, ev.payload as any);
  }
  subscribe() { /* la consommation MVP passe par OutboxWorker */ }
}

// Adaptateur 2 (P1) : BullMQ. Adaptateur 3 (P3) : Kafka — mêmes 15 lignes.
// export class BullmqEventBus extends EventBusPort { … Queue(type).add(ev) … }
