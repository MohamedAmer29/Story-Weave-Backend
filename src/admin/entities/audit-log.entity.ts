import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index('IDX_audit_admin_created', ['adminId', 'createdAt'])
@Index('IDX_audit_action', ['action'])
@Index('IDX_audit_target_type', ['targetType'])
@Index('IDX_audit_target_id', ['targetId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_audit_admin_id')
  @Column()
  adminId: string;

  @Column({ nullable: true, type: 'varchar' })
  adminEmail: string | null;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ nullable: true, type: 'varchar' })
  targetType: string | null;

  @Column({ nullable: true, type: 'varchar' })
  targetId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: object | null;

  @Column({ nullable: true, type: 'varchar' })
  ip: string | null;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  userAgent: string | null;

  @Index('IDX_audit_created_at')
  @CreateDateColumn()
  createdAt: Date;
}
