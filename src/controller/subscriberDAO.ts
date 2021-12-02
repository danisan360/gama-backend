import { getDBConnection } from "../helpers/connection_manager";
import { SelectiveProcessDao } from "./selective_processDAO"
import { Subscriber } from '../models/subscriber'
import { SelectiveProcess } from "../models/selective_process";

export class SubscriberDAO{
    async subscribeInSelectiveProcess(email: string, name: string, birth: Date, selective_process_id: string): Promise<Subscriber>{
        try{
            console.log(email, name, birth, selective_process_id)
            const connection = await getDBConnection()
            let subscriber = new Subscriber()

            const selective_process = await connection
            .getRepository(SelectiveProcess)
            .createQueryBuilder('process')
            .where('process.id=:id', { id: selective_process_id })
            .getOne()
             
            subscriber.birth = birth
            subscriber.email = email
            subscriber.name = name
            subscriber.selectiveProcesss = selective_process

            await connection.manager.save(subscriber)
            return subscriber
        }
        catch(e){
            console.log("Error in subscribeInSelectiveProcess", e)
            return undefined
        }
    }

    async getAllSubscribersInSelectiveProcess(selective_process_id: string): Promise<Subscriber[]>{
        try{
            const connection = await getDBConnection()
            
            const subscribers = await connection
                .getRepository(Subscriber)
                .createQueryBuilder('process')
                .leftJoinAndSelect('process.selectiveProcesss', 'selectiveProcesss')
                .where('process.selectiveProcesss.id = :id', { id: selective_process_id })
                .getMany()
            console.log(subscribers)
            return subscribers
        }
        catch(e){
            console.log(e)
            return undefined
        }
    }
}