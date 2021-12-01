import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { SelectiveProcess } from './selective_process'

@Entity()
export class Subscriber {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    birth: Date; 

    @Column({
        length: 64
    })
    email: string;

    @ManyToOne(() => SelectiveProcess, selectiveProcess => selectiveProcess.subscribers, {
        cascade: true,
        onDelete: 'CASCADE'
    })
    selectiveProcesss: SelectiveProcess;
}