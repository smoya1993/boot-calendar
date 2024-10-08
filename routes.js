const express = require('express')
const axios = require('axios');
const router = express.Router()
const { MessagingResponse } = require('twilio').twiml;
const responses = require("./responses")
const { checkValid, findInState,groupBy,removeInState} = require("./utility")

let state = []
let currentUser = null;
let votes =  [
    {candidate: 1, user: "+23400000000"},
    {candidate: 2, user: "+234494002233"},
    {candidate: 1, user: "+234224940033"},
    {candidate: 2, user: "+234494003003"},
    {candidate: 2, user: "+234494002203"},

]

let candidates = [
    {
        id: 1, name:"Donald Trump and Mike Pence"
    },
    {
        id: 2, name:"Joe Biden and Kamala Harris"
    }
]


//////////////////// Candidate Section ////////////////////

/**
 * Adds more candidates to the candidates pool (ADMIN only)
 * @param {String} [val] - Candidates to be added
 * @return {String} Response message
 */
const addCandidate = (val) => {
    
    if(String(process.env.ADMIN) !== String(currentUser)) return responses.not_allowed
    if(findInState(state,4, currentUser)){
        if(String(val).length === 0) return responses.no_candidate_supplied
        let pivot = candidates.length === 0 ? 1 : Number(candidates[candidates.length-1].id) + 1;
        let newCand = String(val).split(',').map((e,i) => {
            return {id: pivot + i, name: e}
        })
        state = removeInState(state,4,currentUser)
        candidates = [...candidates,...newCand]
        return responses.added_candidates 
     }else{
         state.push({key:4, user:currentUser})
         return responses.confirm_add_of_candidates()
    }

}

/* Used to delete a specific candidate - (ADMIN only)
 * @param {String} from - Voters identity
 * @param {Number} [val] - Candidate id
 * @return {String} Response message
 */
const deleteCandidate = (from,val) => {

    if(String(process.env.ADMIN) !== String(currentUser)) return responses.not_allowed
    if(candidates.length === 0) return responses.no_candidate    
    
    if(findInState(state,5, currentUser)){
            //Checks if candidate supplied by admin is a valid candidate
            if (!checkValid(candidates,val,'id')){
                return responses.chooseValidCandidate(from) + '\n' +responses.list_of_candidate(showCandidates)
            }
            state = removeInState(state,5,currentUser)
            candidates = candidates.filter(e => e.id !== val)
            votes = votes.filter(e => e.candidate !== val)
            return responses.deleted_candidate 
    }else{
            state.push({key:5, user: currentUser})
            return responses.confirm_delete_of_candidate(showCandidates)
   }
    
}
/**
 * Shows all available candidates
 * @return {String} Response message
 */
const showCandidates = () => {
    if(candidates.length === 0) return responses.no_candidate
    return `
    List of Candidates:
    \n`
    +candidates.map((e,i) => {
        return `\n ${e.id} - ${e.name}`
    })
}

/**
 * Deletes all available candidates - (ADMIN only)
 * @return {String} Response message
 */
const clearCandidates = () => {
    if(String(process.env.ADMIN) !== String(currentUser)) return responses.not_allowed

    if(candidates.length === 0) return responses.no_candidate

    if(findInState(state,6, currentUser)){
        candidates = []
        state = removeInState(state,6,currentUser)
        return responses.deleted_candidates 
     }else{
         state.push({key:6 , user: currentUser})
         return responses.confirm_delete_of_candidates()
    }

}

/////////////////// Candidate Section Ends /////////////////////


//////////////// Vote Section  /////////////////////////


/**
 * Adds a users vote
 * @param {String} from - Voters identity
 * @param {Number} val - Candidate Identity
 * @return {String} Response message
 */

const addVote = (from,val) => {
    //Checks if candidate supplied by voter is a valid candidate
    if (!checkValid(candidates,val,'id'))
        return responses.chooseValidCandidate(from) + '\n' +responses.list_of_candidate(showCandidates)

    votes.push({ candidate: val, user: from})
    state = removeInState(state,1,currentUser)
    return responses.valid_vote(from)
}


/**
 * Used to cast users vote
 * @param {String} from - Voters identity
 * @param {Number} [val] - Candidate id
 * @return {String} Response message
 */
const castVote = (from,val) => { 
    //Checks if user has already casted vote
    if (checkValid(votes,from,'user')) return responses.duplicate_vote(from)
    if(findInState(state,1, currentUser)){
       if(candidates.length === 0) return responses.no_candidate;
       return addVote(from,val)
    }else{

        if(candidates.length === 0) return responses.no_candidate;
        state.push({key: 1, user: currentUser})
        return responses.list_of_candidate(showCandidates)
   }
}


/**
 * Deletes all available votes - (ADMIN only)
 * @return {String} Response message
 */
const clearVotes = () => {
    if(String(process.env.ADMIN) !== String(currentUser)) return responses.not_allowed

    if(votes.length === 0) return responses.no_votes

    if(findInState(state,7, currentUser)){
        votes = []
        state = removeInState(state,7,currentUser)
        return responses.deleted_votes 
     }else{
         state.push({key: 7, user:currentUser})
         return responses.confirm_delete_of_votes()
    }

}

/**
 * Used to format response
 * @param {Array} res - Array of votes grouped by candidates id
 * @return {Object} Response message
 */

const formatResult = (res) => {
    let candidate = []
    for(key in res){
        candidate.push({
            name: candidates.find(e => Number(e.id) === Number(key)).name,
            percentage: Math.round((res[key].length / votes.length) * 100),
            total: res[key].length
        })
    }
    console.log(candidate)
    candidate.sort((a,b) => b.total - a.total )
    return {
        winner: candidate[0].total && candidate[1] && candidate[0].total === candidate[1].total ? responses.draw : `🌟 ${candidate[0].name} 🌟`,
        candidate
    }
}

/**
 * Shows results of votes cast
 * @return {String} Response message
 */

const showResult = () => {
    if(votes.length === 0) return responses.no_votes
    if(candidates.length === 0) return responses.no_candidate
    
    let result = groupBy(votes,'candidate');
    result = formatResult(result)
    return `
    ---- General Statistics -----
    Total Votes cast: ${votes.length}
    Result breakdown:
    \n
    ${ responses.showResult(result)}


    -----  Winner so far  ------
    ${result.winner}
    Time:    ${new Date()}
`
}

//////////////// Vote Section Ends  /////////////////////////


//////////////// Display Messages //////////////////////////

/**
 * Shows default message
 * @return {String} Response message
 */

const showDefaultMessage = () => {
    return `
    💥 Welcome to E-Voter 💥
         --- All ---
        1 - Vote
        2 - See Candidates
        3 - See results

        --- Admin --- 
        4 - Add Candidate
        5 - Delete Candidate
        6 - Clear Candidates
        7 - Clear Votes
        8 - Help
    `
}


/**
 * Used to show help to users
 * @return {String} Response message
 */
const showHelp = () => {
    return `
    💥 Welcome to E-Voter 💥
         --- All ---
        1 - Vote: Allows user to vote by entering candidate id
        2 - See Candidates: See all participating candidate
        3 - See results: See the breakdown of results

        --- Admin --- 
        4 - Add Candidate: Add more candidate, 
                a comma sepearted list to add in bulk
                e.g joshua,Gbenga,kdkd
        5 - Delete Candidate: Delete a candidate and their votes

        6 - Clear Candidates: Removes all candidates from the application
        7 - Clear Votes: Removes all votes cast so far from the application
        8 - Help: Shows this help message

        The ball is in your court now ✌️
    `
}


const footer = `

  Created With ❤️ by Chibuike 🔥 (chibuikenwa.com)

`

/////////////// Display Messages Ends ///////////////////

router.post('/', async function(req, res, next) {
    const twiml = new MessagingResponse();
    const body = req.body.Body; // El mensaje de WhatsApp
    const from = req.body.From; // Número del remitente (teléfono)
    
    try {
        // Llama a la función que hace la solicitud al webhook
        const webhookResponse = await sendEventToWebhook(from, body); // Captura la respuesta del webhook
        
        // Accede al campo 'content' dentro de 'messages' en la respuesta
        const content = webhookResponse.messages?.[0]?.content || "No content available";

        console.log('Respuesta del webhook:', content); // Muestra el contenido recibido en el webhook

        // Utiliza el 'content' de la respuesta para enviar un mensaje al usuario
        twiml.message(`Evento procesado correctamente. Detalles: ${content}`);
        return res.status(200).send(twiml.toString());

    } catch (error) {
        return next(error);
    }
});



// Función para enviar datos al webhook externo
const sendEventToWebhook = async (from, body) => {
    try {
        const response = await axios.post('https://n8n-xw9f.onrender.com/webhook/add-event-to-calendar', {
            ctx: {
                from: from,  // Número del remitente
                body: body   // Mensaje del cuerpo
            }
        });
        console.log('Webhook called successfully', response.data);
        return response.data; // Puedes retornar los datos de la respuesta si es necesario
    } catch (err) {
        console.error('Error llamando al webhook', err);
        throw new Error('Error procesando el evento');
    }
};

module.exports = router;
