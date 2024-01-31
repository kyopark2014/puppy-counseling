# Puppy Counseling (강아지 로봇 상담소)

강아지 로봇 상담소에서는 방문자의 사진을 분석하여 사용자의 표정을 분석하여 적절한 리엑션을 수행합니다. 

## 구성

### 시나리오

- 각 3마리씩 3팀으로 나눠서 동시에 3명의 고객이 입장할 수 있도록 공간을 만듭니다.
- 사용자는 입장하면서 카메라 센서로 사진을 찍고 이름을 입력합니다. 
- 3마리의 강아지 로봇은 사용자에게 다가가 사진 분석에 맞는 리액션을 선보입니다.
- 첫번째 강아지 로봇은 사용자 이름을 부르면서 사용자의 표정을 Rekognition 서비스를 통해 기분을 분석하고 다정하게 위로의 말 또는 공감의 말을 건네는 리액션을 합니다. 
- 두번째 강아지 로봇은 사용자 이름을 부르면서 옷차림의 색깔을 인식해서 잘어울린다는 칭찬의 한마디를 건넵니다.
- 세번째 강아지 로봇은 표정에 따라 위로의 댄스 또는 기쁨의 댄스 등 사용자를 위한 춤을 춥니다.
- 리액션이 끝나면 다같이 안녕의 댄스와 함께 처음에 찍은 사진과 강아지 로봇을 합성한 기념사진을 건네줍니다.
- 강아지 로봇의 귀여운 리액션으로 고객에게 GenAI와 IoT가 결합된 특별하고 기분좋은 경험을 선사합니다.

## 개발환경

동작 알고리즘을 개발하기 위하여 아래와 같은 Architecture를 이용합니다. 

![image](https://github.com/kyopark2014/puppy-counseling/assets/52392004/2328599d-00b5-48ab-af89-41cfb82330bf)


### 관련 서비스

Rekognition: 표졍 분석, 옷차림 분석

Bedrock Claude: Prompt에 기반하여 방문자용 메시지 준비

Polly: 메시지를 음성으로 전환

