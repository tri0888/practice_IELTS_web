import type { ApiRequest } from '../../shared/http'
import * as audioService from './audio.services'

export const getFile = (req: ApiRequest) => audioService.getAudioFile(req.params.file_name)
