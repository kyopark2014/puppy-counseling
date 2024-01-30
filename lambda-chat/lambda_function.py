import boto3
import os
import time
import re

from langchain.prompts import PromptTemplate
from langchain.llms.bedrock import Bedrock
from botocore.config import Config
from urllib import parse
import traceback

bucket = os.environ.get('s3_bucket') # bucket name
s3_prefix = os.environ.get('s3_prefix')
historyTableName = os.environ.get('historyTableName')
path = os.environ.get('path')
speech_prefix = 'speech/'

s3 = boto3.client('s3')
polly = boto3.client('polly')
   
HUMAN_PROMPT = "\n\nHuman:"
AI_PROMPT = "\n\nAssistant:"
def get_parameter():
    return {
        "max_tokens_to_sample":512, # 8k    
        "temperature":0.1,
        "top_k":250,
        "top_p":0.9,
        "stop_sequences": [HUMAN_PROMPT]
    }

selected_LLM = 0
profile_of_LLMs = [
    {
        "bedrock_region": "us-west-2", # Oregon
        "model_type": "claude",
        "model_id": "anthropic.claude-instant-v1",
        "maxOutputTokens": "8196"
    },
    {
        "bedrock_region": "us-east-1", # N.Virginia
        "model_type": "claude",
        "model_id": "anthropic.claude-instant-v1",
        "maxOutputTokens": "8196"
    },
    {
        "bedrock_region": "ap-northeast-1", # Tokyo
        "model_type": "claude",
        "model_id": "anthropic.claude-instant-v1",
        "maxOutputTokens": "8196"
    },    
    {
        "bedrock_region": "eu-central-1", # Europe (Frankfurt)
        "model_type": "claude",
        "model_id": "anthropic.claude-instant-v1",
        "maxOutputTokens": "8196"
    },
]

def get_llm(profile_of_LLMs, selected_LLM):
    profile = profile_of_LLMs[selected_LLM]
    bedrock_region =  profile['bedrock_region']
    modelId = profile['model_id']
    print(f'LLM: {selected_LLM}, bedrock_region: {bedrock_region}, modelId: {modelId}')
        
    # bedrock   
    boto3_bedrock = boto3.client(
        service_name='bedrock-runtime',
        region_name=bedrock_region,
        config=Config(
            retries = {
                'max_attempts': 30
            }            
        )
    )
    parameters = get_parameter()

    # langchain for bedrock
    llm = Bedrock(
        model_id=modelId, 
        client=boto3_bedrock, 
        model_kwargs=parameters)
    
    return llm

def get_prompt_template():
    prompt_template = """\n\nHuman: 다음 <profile> tag는 Human의 특징을 설명하고 있습니다. Assistant는 유치원 선생님처럼 Human의 기분에 맞추어서 인사를 해주세요.
            
    <profile>
    {input}
    </profile>
    
    Assistant:"""    
    
    return PromptTemplate.from_template(prompt_template)

def get_text_speech(path, speech_prefix, bucket, msg):
    ext = "mp3"    
    try:
        response = polly.start_speech_synthesis_task(
            Engine='neural',
            LanguageCode='ko-KR',
            OutputFormat=ext,
            OutputS3BucketName=bucket,
            OutputS3KeyPrefix=speech_prefix,
            Text=msg,
            TextType='text',
            VoiceId='Seoyeon'        
        )
        print('response: ', response)
    except Exception:
        err_msg = traceback.format_exc()
        print('error message: ', err_msg)        
        raise Exception ("Not able to create voice")
    
    object = '.'+response['SynthesisTask']['TaskId']+'.'+ext
    print('object: ', object)

    return path+speech_prefix+parse.quote(object)
    
def lambda_handler(event, context):
    print(event)
    userId  = event['user_id']
    print('userId: ', userId)
    requestId  = event['request_id']
    print('requestId: ', requestId)
    requestTime  = event['request_time']
    print('requestTime: ', requestTime)
    type  = event['type']
    print('type: ', type)
    body = event['body']
    print('body: ', body)
    
    llm = get_llm(profile_of_LLMs, selected_LLM)

    start = int(time.time())    
    
    PROMPT = get_prompt_template()
    #print('PROMPT: ', PROMPT)
    
    try: 
        msg = llm(PROMPT.format(input=body))
    except Exception:
        err_msg = traceback.format_exc()
        print('error message: ', err_msg)               
        msg = err_msg
        
    elapsed_time = int(time.time()) - start
    print("total run time(sec): ", str(elapsed_time))
        
    print('msg: ', msg)
    speech_uri = get_text_speech(path, speech_prefix, bucket, msg)
    
    return {
        'statusCode': 200,
        'request_id': requestId,
        'msg': msg,
        'speech_uri': speech_uri
    }
