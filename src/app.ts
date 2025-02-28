import express from 'express'
import 'reflect-metadata'
import { ContractorDAO } from './controller/contractorDAO'
import { SelectiveProcessDao } from './controller/selective_processDAO'
import { genUserToken, authMiddleware, unauthorized } from './helpers/authentication'
import { celebrate, Joi, errors, Segments } from 'celebrate'
import { PasswordHandler } from './helpers/password_handler'
import expressHumps from 'express-humps'
import cors from 'cors'
import { Contractor } from './models/contractor'
import { SubscriberDAO } from './controller/subscriberDAO'

let corsOptions = {
  origin: process.env.ACCEPTED_URL
}

const app = express()
app.disable("x-powered-by");

app.use(express.json())
app.use(cors(corsOptions))
app.use(expressHumps())


const connection = new ContractorDAO()
const connectionProcess = new SelectiveProcessDao()
const connectionSubscriber = new SubscriberDAO()

app.post('/contratante', celebrate({
      [Segments.BODY]: Joi.object().keys({
        email: Joi.string().trim().email().required(),
        cnpj: Joi.string().min(14).max(14).pattern(/^\d+$/).required(),
        companyName: Joi.string().max(128).required(),
        tradeName: Joi.string().max(128).required(),
        password: Joi.string().pattern(/^[a-zA-Z0-9!@#$%&*]{8,16}$/).required()
      }),
  }), async (request, response) => {
  const { email, cnpj, companyName, tradeName, password } = request.body
  
  let contractor = await connection.addContractor(email, cnpj, tradeName, companyName, password)

  if (!contractor) return response.status(403).json({ message: 'Unable to create user.' })

  const json = {
    message: 'User created',
    id: contractor.id,
    email: contractor.email,
    password: contractor.password,
    cnpj: contractor.cnpj,
    companyName: contractor.companyName,
    tradeName: contractor.tradeName,
    authorization: genUserToken({ id: contractor.id })
  }

  return response.json(json)
})

app.get('/contratante', celebrate({
      [Segments.QUERY]: Joi.object().keys({
        id: Joi.number().required()
      }),
  }), async (request, response) => {
  const { id } = request.query

  const contractor = await connection.findContractor(Number(id))

  if (contractor === undefined) {
    return response.status(404).json({ message: 'contractor not found' })
  }
  const json = {
    message: 'Foi encontrado',
    email: contractor.email,
    password: contractor.password,
    cnpj: contractor.cnpj,
    companyName: contractor.companyName,
    tradeName: contractor.tradeName,
    twoStepValidation: contractor.twoStepEnabled
  }

  return response.json(json)
})

app.get('/contratante/todos', async (request, response) => {
  const contractor = await connection.findAllContractors()

  return response.json(contractor)
})

app.use('/contratante', authMiddleware)
app.delete('/contratante/:id', celebrate({
      [Segments.PARAMS]: Joi.object().keys({
        id: Joi.number().required()
      }),
  }), async (request, response) => {
  const { id } = request.params
  let contractor = await connection.findContractor(Number(id))
  if (!contractor) return response.status(404).json({ message: 'Contractor not found' })
  if (contractor.id !== response.locals.session.id) return unauthorized(response)
  contractor = await connection.findAndDeleteContractor(Number(id))

  const json = {
    message: 'Foi Removido',
    email: contractor.email,
    password: contractor.password,
    cnpj: contractor.cnpj,
    companyName: contractor.companyName,
    tradeName: contractor.password
  }

  return response.json(json)
})

app.use('/contratante', authMiddleware)
app.put('/contratante/:id', celebrate({
      [Segments.BODY]: Joi.object().keys({
        email: Joi.string().trim().email().required(),
        cnpj: Joi.string().min(14).max(14).pattern(/^\d+$/).required(),
        companyName: Joi.string().max(128).required(),
        tradeName: Joi.string().max(128).required(),
        password: Joi.string().pattern(/^[a-zA-Z0-9!@#$%&*]{8,16}$/).required()
      }),
      [Segments.PARAMS]: Joi.object().keys({
        id: Joi.number().required()
      })
  }), async (request, response) => {
  const { id } = request.params
  let contractor = await connection.findContractor(Number(id))


  if (!contractor) return response.status(404).json({ message: 'Contractor not found' })
  if (contractor.id !== response.locals.session.id) return unauthorized(response)

  const { email, cnpj, companyName, tradeName, password } = request.body

  if(await connection.findContractor(email)) {
      return response.status(403).json({message: 'Invalid email'})
  }

  contractor = await connection.updateContractor(Number(id), email, cnpj, tradeName, companyName, password)


  const json = {
    message: 'Foi atualizado',
    email: contractor.email,
    password: contractor.password,
    cnpj: contractor.cnpj,
    companyName: contractor.companyName,
    tradeName: contractor.tradeName
  }

  return response.json(json)
})

app.use('/contratante', authMiddleware)
app.put('/contratante/ativarduasetapas/:id', celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.number().required()
  })
}), async(request, response) => {
  const { id } = request.params

  let contractor = await connection.findContractor(Number(id))
  if(!contractor) return response.status(400).json({ message: 'Contractor not found' })
  if (contractor.id !== response.locals.session.id) return unauthorized(response)
  
  let token: string = await connection
    .activateTwoStepVerification(contractor.id)

  return response.json(token)
})

app.use('/contratante', authMiddleware)
app.get('/contratante/validartoken/:id', celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.number().required()
  }),
  [Segments.BODY]: Joi.object().keys({
    token: Joi.number().required()
  })
}), async(request, response) => {
  const { id } = request.params
  const { token } = request.body

  let contractor = await connection.findContractor(Number(id))
  if(!contractor) return response.status(400).json({ message: 'Contractor not found' })
  if (contractor.id !== response.locals.session.id) return unauthorized(response)
  console.log(token)
  const verified = await connection
    .validateToken(contractor.id, token)
  
  return response.json(verified)
})

app.get('/processo-seletivo/todos', async (request, response) => {
  const process = await connectionProcess.findAllSelectiveProcesses()

  return response.json(process)
})

app.get('/processo-seletivo', celebrate({
      [Segments.QUERY]: Joi.object().keys({
        id: Joi.number().required()
      }),
  }), async (request, response) => {
  const { id } = request.query
  const process = await connectionProcess.findSelectiveProcessById(Number(id))

  if (process === undefined) {
    return response.status(404).json({ message: 'process not found' })
  }

  const json = {
    message: 'Foi encontrado',
    id: process.id,
    title: process.title,
    description: process.description,
    methodOfContact: process.methodOfContact,
    deadline: process.deadline,
    id_contractor: process.contractor.id
  }
  return response.json(json)
})

app.get('/findProcessByTitle', celebrate({
      [Segments.QUERY]: Joi.object().keys({
        title: Joi.string().max(128).required()
      }),
  }), async (request, response) => {
  const { title } = request.query
  const process = await connectionProcess.findSelectiveProcessByTitle(String(title))

  if (process === undefined) {
    return response.json({ message: 'process not found' })
  }

  const json = {
    message: 'Foi encontrado',
    id: process.id,
    title: process.title,
    description: process.description,
    methodOfContact: process.methodOfContact,
    deadline: process.deadline,
    id_contractor: process.contractor.id
  }

  return response.json(json)
})

app.get('/processo-seletivo/:id', celebrate({
      [Segments.PARAMS]: Joi.object().keys({
        id: Joi.number().required()
      }),
  }), async (request, response) => {
  const { id } = request.params
  const processes = await connectionProcess.findSelectiveProcessOfContractorById(Number(id))

  if (processes === undefined) {
    return response.json({ message: 'process not found' }) // create test
  }

  processes.forEach(process => {
    delete process.contractor
  })

  return response.json(processes)
})

app.use('/processo-seletivo', authMiddleware)
app.post('/processo-seletivo', celebrate({
      [Segments.BODY]: Joi.object().keys({
        title: Joi.string().max(128).required(),
        description: Joi.string().max(128).required(),
        deadline: Joi.string().required(),
        methodOfContact: Joi.string().max(64).required()
      }),
  }), async (request, response) => {
  const { title, description, deadline, methodOfContact } = request.body

  const contractorId = response.locals.session.id
  let process = await connectionProcess.addSelectiveProcess(title, description, deadline, methodOfContact, contractorId)

  if (process === undefined) {
    return response.json({ message: 'process not found' })// create test
  }

  const json = {
    message: 'Foi inserido',
    id: process.id,
    title: process.title,
    description: process.description,
    methodOfContact: process.methodOfContact,
    deadline: process.deadline,
    id_contractor: process.contractor.id
  }
  return response.json(json)
})

app.use('/processo-seletivo', authMiddleware)
app.delete('/processo-seletivo/:id', celebrate({
      [Segments.PARAMS]: Joi.object().keys({
        id: Joi.number().required()
      }),
  }), async (request, response) => {
  const { id } = request.params

  const contractorId = response.locals.session.id
  const contractor = await connection.findContractorById(contractorId)
  let process = await connectionProcess.findSelectiveProcessById(Number(id))
  if (!contractor || process.contractor.id !== contractor.id) return response.status(404).json({ message: 'Invalid contractor.' })

  process = await connectionProcess.deleteSelectiveProcessById(Number(id))

  const json = {
    message: 'Foi removido',
    id: process.id,
    title: process.title,
    description: process.description,
    methodOfContact: process.methodOfContact,
    deadline: process.deadline,
    id_contractor: process.contractor.id
  }

  return response.json(json)
})

app.post('/login', celebrate({
  [Segments.BODY]: Joi.object().keys({
    email: Joi.string().trim().email().required(),
    password: Joi.string().pattern(/^[a-zA-Z0-9!@#$%&*]{8,16}$/).required()
  }),
}), async (request, response) => {
  const { email, password } = request.body
  if (!email) return response.status(400).json({ message: 'Email field is missing.' })
  if (!password) return response.status(400).json({ message: 'Password field is missing.' })

  const pwHandler = new PasswordHandler()
  const contractor = await connection.findContractorByEmail(email)
  
  if (!contractor || 
      !(await pwHandler.authenticateContractor(
          password, 
          contractor.password)
        )
      ) {
    return response.status(403).json({ message: 'Invalid username or password.' })
  }

  if(contractor.twoStepEnabled)
    return response.json({ twoStepEnabled: true, usuarioId: contractor.id })
  
  return response.json({ twoStepEnabled: false, authorization: genUserToken({ id: contractor.id }) })
})

app.get('/login/validartoken', celebrate({
  [Segments.BODY]: Joi.object().keys({
    id: Joi.number().required(),
    token: Joi.number().required()
  })
}), async(request, response) => {
  const { id, token } = request.body

  let contractor: Contractor = await connection.findContractor(id)

  if(!contractor)
    return response.status(403).json({ message: 'Invalid user.'})
  
  let validated: boolean = await connection.validateToken(id, token)

  if(validated)
    return response.json({ authorization: genUserToken({ id: contractor.id }) })
  else
    return response.status(403).json({ message: 'Invalid token.' })
})

app.post('/subscriber', async(request, response) => {
  const { email, name, birth, selectiveProcessId} = request.body

  let subscriber = await connectionSubscriber.subscribeInSelectiveProcess(email, name, birth, selectiveProcessId)

  if(!subscriber)
    return response.status(403).json({ message: 'It was not possible to enroll in the selective process.' })

  const json = {
    message: 'Foi inscrito',
    id: subscriber.id,
    email: subscriber.email,
    name: subscriber.name,
    birth: subscriber.birth,
    selective_process_id: subscriber.selectiveProcesss
    }
  return response.json(json)
})

app.get('/subscriber', async(request, response) => {
  const { selectiveProcessId} = request.body

  let subscriber = await connectionSubscriber.getAllSubscribersInSelectiveProcess(selectiveProcessId)

  if(!subscriber)
    return response.status(403).json({ message: 'Erro' })

  console.log(subscriber)
  return response.json(subscriber)
})

app.use(errors())
export { app }
